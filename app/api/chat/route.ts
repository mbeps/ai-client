import { auth } from "@/lib/auth/auth";
import { env } from "@/lib/env";
import { headers } from "next/headers";
import { streamText, stepCountIs } from "ai";
import { chatRequestSchema } from "@/schemas/chat/chat";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import { logger } from "@/lib/logger";
import { SSE_HEADERS } from "@/constants/sse";
import {
  VisionNotSupportedError,
  ToolsNotSupportedError,
} from "@/constants/errors";
import {
  loadChatContext,
  ChatNotFoundError,
} from "@/lib/chat/load-chat-context";
import { checkVisionSupport } from "@/lib/chat/vision-guard";
import { buildProviderErrorResponse } from "@/lib/chat/build-provider-error";
import { getAttachmentUrls } from "@/lib/chat/attachments/get-attachment-urls";
import { prepareChatMessages } from "@/lib/chat/prepare-chat-messages";
import { createChatStream } from "@/lib/chat/chat-stream";

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
    const attachmentUrls = await getAttachmentUrls(history, session.user.id);
    const finalMessages = prepareChatMessages({
      history,
      globalSystemPrompt,
      projectPrompt: ctx.projectRow?.globalPrompt,
      assistantPrompt: ctx.assistantRow?.prompt,
      kbIsReady: ctx.kbIsReady,
      attachmentUrls,
    });

    const isToolCallingModel = !!resolvedModelRow?.capTools;
    if (!isToolCallingModel && hasMcpTools) {
      throw new ToolsNotSupportedError();
    }

    // --- Stream AI response ---
    const result = streamText({
      model: resolved.sdkProvider.chat(resolvedModelId),
      messages: finalMessages,
      tools: isToolCallingModel && hasMcpTools ? mcpTools : undefined,
      stopWhen:
        isToolCallingModel && hasMcpTools
          ? stepCountIs(env.CHAT_MAX_STEPS)
          : undefined,
      abortSignal: req.signal,
    });

    const stream = createChatStream({
      result,
      chatId,
      userId: session.user.id,
      userMessageId,
      resolvedModelId,
      toolSourceMap,
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
