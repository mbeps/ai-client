import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { chatRequestSchema } from "@/schemas/chat/chat";
import { assembleModelMessages } from "@/lib/chat/assemble-model-messages";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";
import {
  resolveDefaultChatProvider,
  resolveProvider,
} from "@/lib/chat/resolve-provider";
import { getPresignedUrl } from "@/lib/storage/s3-client";
import { logger } from "@/lib/logger";
import { encodeSSE, SSE_HEADERS } from "@/lib/utils/sse";
import {
  VisionNotSupportedError,
  ToolsNotSupportedError,
  RATE_LIMIT_ERROR_CODE,
} from "@/lib/constants/errors";
import {
  isRateLimitError,
  normalizeRateLimitMessage,
} from "@/lib/utils/error-utils";
import {
  loadChatContext,
  ChatNotFoundError,
} from "@/lib/chat/load-chat-context";
import { checkVisionSupport } from "@/lib/chat/vision-guard";
import { persistAssistantResponse } from "@/lib/chat/persist-response";
import {
  handleStreamChunk,
  type StreamState,
} from "@/lib/chat/stream-chunk-handler";
import { buildProviderErrorResponse } from "@/lib/chat/build-provider-error";

export const maxDuration = 60;

/**
 * Streams AI chat responses with model context, system prompts, MCP tool integration, and message persistence.
 * Authenticates via Better Auth session, validates request schema, loads chat context (project, assistant,
 * knowledgebases), registers MCP tools, and streams text via Server-Sent Events (SSE) using Vercel AI SDK.
 *
 * **HTTP Method:** POST
 *
 * **Request Format:** JSON with chatId, userMessageId, messages, model, selectedServerIds, selectedTools,
 * selectedAssistantId, selectedKbIds
 *
 * **Response Format:** Server-Sent Events (SSE) stream with chunk updates and final assistant message persisted to DB
 *
 * **Authentication:** Required (Better Auth session)
 *
 * **Real-time Pattern:** Streaming with per-chunk SSE encoding and async DB persistence
 *
 * **Integration Points:** Better Auth, Vercel AI SDK `streamText`, MCP tool registration, vision/tools capability
 * guards, message assembly, system prompt building, artifact management
 *
 * @author Maruf Bepary
 * @see {@link lib/chat/load-chat-context} for database context loading
 * @see {@link lib/chat/register-mcp-tools} for MCP tool registration
 * @see {@link lib/chat/stream-chunk-handler} for per-chunk SSE encoding
 * @see {@link lib/chat/persist-response} for assistant message persistence
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  // Fetch user settings (global system prompt)
  const userSettings = await getUserSettings().catch(() => null);
  const globalSystemPrompt = userSettings?.globalSystemPrompt;

  const body = await req.json();
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    logger.error(
      "[Chat API] Invalid request:",
      JSON.stringify(parsed.error.format(), null, 2),
    );
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    chatId,
    userMessageId,
    messages: history,
    model: requestedModel,
    selectedServerIds,
    selectedTools,
    selectedAssistantId,
    selectedKbIds,
  } = parsed.data;

  // Ensure model is undefined if empty or whitespace-only
  const model =
    requestedModel && requestedModel.trim() !== "" ? requestedModel : undefined;

  let mcpCleanup: () => Promise<void> = async () => {};

  try {
    // --- Resolve AI provider & model ---
    const resolved = model
      ? await resolveProvider(session.user.id, model)
      : await resolveDefaultChatProvider(session.user.id);

    const resolvedModelRow = {
      capVision: resolved.modelRow.capVision,
      capTools: resolved.modelRow.capTools,
    };
    const resolvedModelId = resolved.modelId;

    logger.info(
      "[Chat API] Request initialized",
      {
        chatId,
        userMessageId,
        model,
        selectedServerIds,
        selectedAssistantId,
      },
      session.user.id,
    );

    // --- Load database context (parallelised queries) ---
    const ctx = await loadChatContext(
      chatId,
      session.user.id,
      selectedServerIds,
      selectedKbIds,
      selectedAssistantId,
    );

    // --- Register MCP tools ---
    const isArtifactToolSelected = selectedTools?.includes(
      "internal:tool:manage_artifact",
    );

    const {
      mcpTools,
      toolSourceMap,
      mcpCleanup: registeredCleanup,
    } = await registerMcpTools(
      ctx.servers as any,
      selectedTools,
      !!isArtifactToolSelected,
      ctx.activeKbId,
      session.user.id,
    );
    mcpCleanup = registeredCleanup;

    const hasMcpTools = Object.keys(mcpTools).length > 0;

    // --- Verify model capabilities ---
    if (!checkVisionSupport(history, !!resolvedModelRow?.capVision)) {
      throw new VisionNotSupportedError();
    }

    // --- Prepare messages ---
    const processedMessages = assembleModelMessages(history);

    // Identify attachments in the latest user message for
    // Tool/Model-based access via presigned URLs
    const lastUserMessage = history.filter((m) => m.role === "user").pop();
    const messageAttachments =
      lastUserMessage?.attachments?.filter((a) => a.key) ?? [];

    // Generate presigned S3 URLs for all file types (images, documents,
    // spreadsheets) to enable Tool/Model-based access
    const attachmentUrls = await Promise.all(
      messageAttachments.map(async (a) => {
        const url = await getPresignedUrl(a.key!);
        return { name: a.name, url };
      }),
    );

    const systemMessages = buildSystemPrompt(
      globalSystemPrompt,
      ctx.projectRow?.globalPrompt,
      ctx.assistantRow?.prompt,
      ctx.kbIsReady,
      attachmentUrls,
    );
    const finalMessages: ModelMessage[] = [
      ...systemMessages,
      ...processedMessages,
    ];

    if (finalMessages.length === 0) {
      finalMessages.push({
        role: "system",
        content: "You are a helpful AI assistant.",
      });
    }

    const isToolCallingModel = !!resolvedModelRow?.capTools;
    if (!isToolCallingModel && hasMcpTools) {
      throw new ToolsNotSupportedError();
    }

    // --- Stream AI response ---
    // Use .chat() to force the Chat Completions API endpoint (/chat/completions)
    // rather than the OpenAI Responses API (/responses), which OpenRouter does
    // not support.
    const result = streamText({
      model: resolved.sdkProvider.chat(resolvedModelId),
      messages: finalMessages,
      tools: isToolCallingModel && hasMcpTools ? mcpTools : undefined,
      stopWhen: isToolCallingModel && hasMcpTools ? stepCountIs(10) : undefined,
      abortSignal: req.signal,
    });

    const assistantMessageId = crypto.randomUUID();

    const stream = new ReadableStream({
      async start(controller) {
        // Mutable accumulator for stream state
        const streamState: StreamState = {
          fullText: "",
          fullReasoning: "",
          toolCalls: [],
          toolResults: [],
        };

        try {
          for await (const chunk of result.fullStream) {
            const { ssePayload, stateUpdates } = handleStreamChunk(
              chunk as any,
              streamState,
              {
                chatId,
                userId: session.user.id,
                toolSourceMap,
              },
            );

            // Merge state updates
            if (stateUpdates.fullText !== undefined)
              streamState.fullText = stateUpdates.fullText;
            if (stateUpdates.fullReasoning !== undefined)
              streamState.fullReasoning = stateUpdates.fullReasoning;
            if (stateUpdates.toolCalls !== undefined)
              streamState.toolCalls = stateUpdates.toolCalls;
            if (stateUpdates.toolResults !== undefined)
              streamState.toolResults = stateUpdates.toolResults;

            if (ssePayload) {
              controller.enqueue(encodeSSE(ssePayload));
            }
          }
        } catch (error: any) {
          logger.error("[Chat API Error]", error, { chatId }, session.user.id);
          let message = "An error occurred during generation";
          let code = "ERROR";

          if (isRateLimitError(error)) {
            message = normalizeRateLimitMessage(error);
            code = RATE_LIMIT_ERROR_CODE;
          }

          controller.enqueue(encodeSSE({ type: "error", message, code }));
          return;
        }

        if (
          !streamState.fullText &&
          streamState.toolCalls.length === 0 &&
          !streamState.fullReasoning
        ) {
          controller.enqueue(
            encodeSSE({ type: "error", message: "No response from model" }),
          );
          return;
        }

        // --- Persist assistant response ---
        const metadataObj: Record<string, unknown> = {};
        if (streamState.toolCalls.length > 0) {
          metadataObj.toolCalls = streamState.toolCalls;
          metadataObj.toolResults = streamState.toolResults;
        }
        if (streamState.fullReasoning) {
          metadataObj.reasoning = streamState.fullReasoning;
        }
        metadataObj.model = resolvedModelId;
        const metadata =
          Object.keys(metadataObj).length > 0
            ? JSON.stringify(metadataObj)
            : null;

        await persistAssistantResponse({
          chatId,
          assistantMessageId,
          content: streamState.fullText,
          parentId: userMessageId,
          metadata,
        });

        logger.info(
          "[Chat API] Response completed",
          {
            chatId,
            assistantMessageId,
            textLength: streamState.fullText.length,
            toolCallsCount: streamState.toolCalls.length,
          },
          session.user.id,
        );

        controller.enqueue(
          encodeSSE({
            type: "done",
            id: assistantMessageId,
            metadata: metadata ? JSON.parse(metadata) : undefined,
          }),
        );
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error: unknown) {
    await mcpCleanup();

    // Known application errors
    const knownResponse = buildProviderErrorResponse(error);
    if (knownResponse) return knownResponse;

    // Chat not found
    if (error instanceof ChatNotFoundError) {
      return new Response("Not Found", { status: 404 });
    }

    // Generic / unexpected errors
    const typedError =
      error instanceof Error ? error : new Error(String(error));
    logger.error(
      "[Chat API] Request setup failed",
      typedError,
      { chatId },
      session.user.id,
    );
    return Response.json(
      {
        error: typedError.message || "An error occurred during chat setup.",
      },
      { status: 400 },
    );
  }
}
