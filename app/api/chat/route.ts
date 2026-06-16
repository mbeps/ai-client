import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { assistant, chat, message, mcpServer, project } from "@/drizzle/schema";
import { eq, and, or } from "drizzle-orm";
import { headers } from "next/headers";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { chatRequestSchema } from "@/schemas/chat";
import { assembleModelMessages } from "@/lib/chat/assemble-model-messages";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";
import {
  resolveDefaultChatProvider,
  resolveProviderForModel,
} from "@/lib/chat/resolve-provider";
import { getPresignedUrl } from "@/lib/storage/s3-client";
import { logger } from "@/lib/logger";
import { encodeSSE, SSE_HEADERS } from "@/lib/utils/sse";
import { ProviderNotConfiguredError } from "@/lib/constants/errors";

export const maxDuration = 60;

/**
 * POST handler for the AI chat streaming pipeline.
 * Authenticates via Better Auth session, validates the request schema, fetches Project/Assistant system prompts from the database,
 * loads enabled MCP servers, connects to them, and streams text responses using Vercel AI SDK's `streamText` with tool support.
 * Returns a text/event-stream with content, tool calls, and file-modified events.
 *
 * AUTHENTICATION: Requires valid Better Auth session (401 if missing).
 * STREAMING: Responses are streamed via Server-Sent Events (SSE) for real-time content delivery.
 * MCP INTEGRATION: Discovers tools from enabled MCP servers; supports tool selection via `selectedTools` and `selectedServerIds`.
 * ARTIFACT SUPPORT: The internal `manage_artifact` tool is automatically added if selected; allows AI to create markdown, spreadsheet, HTML, or Mermaid artifacts.
 *
 * @param req - Incoming POST request containing chatId, history, model, MCP server/tool selections, and attachments
 * @returns Streaming response (text/event-stream) with AI content, tool execution results, and file-modified events
 * @throws Returns 401 Unauthorized if Better Auth session is invalid or missing.
 * @throws Returns 400 Bad Request if request body fails schema validation (malformed JSON, missing chatId, invalid message format).
 * @throws Returns 404 Not Found if chatId does not exist or user does not own the chat.
 * @throws Returns error response if AI provider (OpenRouter) returns rate limit (429) or API error — sent as SSE error event.
 * @throws Returns error response if MCP tool discovery or execution fails — sent as SSE error event with details.
 * @throws Returns error response if message persistence to database fails — sent as SSE error event.
 * @see getMcpTools for MCP tool discovery and connection management
 * @author Maruf Bepary
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  // Fetch user settings for global prompt
  const userSettings = await getUserSettings().catch(() => null);
  const globalSystemPrompt = userSettings?.globalSystemPrompt;

  const body = await req.json();
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    console.error(
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

  const model = requestedModel;

  let provider;
  let resolvedModelRow: { capVision: boolean; capTools: boolean } | null = null;
  let resolvedModelId = "";
  try {
    const resolved = model
      ? await resolveProviderForModel(session.user.id, model)
      : await resolveDefaultChatProvider(session.user.id);
    provider = resolved.sdkProvider;
    resolvedModelId = resolved.modelId;
    resolvedModelRow = {
      capVision: resolved.modelRow.capVision,
      capTools: resolved.modelRow.capTools,
    };
  } catch (error: unknown) {
    if (error instanceof ProviderNotConfiguredError) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 412 },
      );
    }

    const typedError =
      error instanceof Error ? error : new Error(String(error));
    logger.error(
      "[Chat API] AI provider init failed",
      typedError,
      { chatId },
      session.user.id,
    );
    return Response.json(
      {
        error: typedError.message || "Failed to initialize AI provider.",
      },
      { status: 400 },
    );
  }

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

  const [chatRow] = await db
    .select({
      id: chat.id,
      projectId: chat.projectId,
      assistantId: chat.assistantId,
      knowledgebaseId: chat.knowledgebaseId,
    })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) return new Response("Not Found", { status: 404 });

  // Fetch project globalPrompt if this chat belongs to a project
  const projectRow = chatRow.projectId
    ? await db
        .select({
          globalPrompt: project.globalPrompt,
          knowledgebaseId: project.knowledgebaseId,
        })
        .from(project)
        .where(
          and(
            eq(project.id, chatRow.projectId),
            eq(project.userId, session.user.id),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  const activeKbId =
    selectedKbIds?.[0] ??
    chatRow.knowledgebaseId ??
    projectRow?.knowledgebaseId ??
    null;

  const effectiveAssistantId = chatRow.assistantId || selectedAssistantId;

  // Fetch assistant prompt if this chat belongs to an assistant or an assistant was mentioned
  const assistantRow = effectiveAssistantId
    ? await db
        .select({ prompt: assistant.prompt })
        .from(assistant)
        .where(
          and(
            eq(assistant.id, effectiveAssistantId),
            eq(assistant.userId, session.user.id),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  // Fetch enabled MCP servers for this user
  const servers = await db
    .select({
      id: mcpServer.id,
      name: mcpServer.name,
      url: mcpServer.url,
      headers: mcpServer.headers,
    })
    .from(mcpServer)
    .where(
      and(
        or(eq(mcpServer.userId, session.user.id), eq(mcpServer.isPublic, true)),
        eq(mcpServer.enabled, true),
      ),
    );

  // Filter servers by selection if provided
  const filteredServers =
    selectedServerIds && selectedServerIds.length > 0
      ? servers.filter((s) => selectedServerIds.includes(s.id))
      : servers;

  const scopedServers = filteredServers;

  const isArtifactToolSelected = selectedTools?.includes(
    "internal:tool:manage_artifact",
  );

  const { mcpTools, toolSourceMap, mcpCleanup } = await registerMcpTools(
    scopedServers as any,
    selectedTools,
    !!isArtifactToolSelected,
    activeKbId,
    session.user.id,
  );

  const hasMcpTools = Object.keys(mcpTools).length > 0;

  // Filter messages based on model capabilities (e.g., vision)
  const isVisionModel = !!resolvedModelRow?.capVision;
  const filteredHistory = isVisionModel
    ? history
    : history.map((msg) => {
        if (msg.role !== "user") return msg;
        return {
          ...msg,
          attachments: msg.attachments?.filter((att) => att.type !== "image"),
          content: Array.isArray(msg.content)
            ? msg.content.filter((part) => part.type !== "image")
            : msg.content,
        };
      });

  if (
    !isVisionModel &&
    history.some((m) => m.attachments?.some((a) => a.type === "image"))
  ) {
    logger.warn(
      "[Chat API] Stripped images from history for non-vision model",
      {
        model: resolvedModelId,
        chatId,
      },
    );
  }

  const processedMessages = assembleModelMessages(filteredHistory);

  // Identify spreadsheet attachments in the latest user message for HTTP-only tool access
  const lastUserMessage = filteredHistory
    .filter((m) => m.role === "user")
    .pop();
  const spreadsheetAttachments =
    lastUserMessage?.attachments?.filter(
      (a) => a.type === "spreadsheet" && a.key,
    ) ?? [];

  // Generate presigned S3 URLs for spreadsheet files to enable Tool/Model-based access
  const attachmentUrls = await Promise.all(
    spreadsheetAttachments.map(async (a) => {
      const url = await getPresignedUrl(a.key!);
      return { name: a.name, url };
    }),
  );

  const systemMessages = buildSystemPrompt(
    globalSystemPrompt,
    projectRow?.globalPrompt,
    assistantRow?.prompt,
    !!activeKbId,
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
    logger.warn("[Chat API] Stripped tools for non-tool-calling model", {
      model,
      chatId,
    });
  }

  // Use .chat() to force the Chat Completions API endpoint (/chat/completions)
  // rather than the OpenAI Responses API (/responses), which OpenRouter does not support.
  const result = streamText({
    model: provider.chat(resolvedModelId),
    messages: finalMessages,
    tools: isToolCallingModel && hasMcpTools ? mcpTools : undefined,
    stopWhen: isToolCallingModel && hasMcpTools ? stepCountIs(10) : undefined,
    abortSignal: req.signal,
  });

  const assistantMessageId = crypto.randomUUID();
  let fullText = "";
  let fullReasoning = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const toolCalls: {
          toolCallId: string;
          toolName: string;
          args: unknown;
          serverName?: string;
        }[] = [];
        const toolResults: {
          toolCallId: string;
          toolName: string;
          result: unknown;
        }[] = [];

        try {
          for await (const chunk of result.fullStream) {
            switch (chunk.type) {
              case "text-delta":
                fullText += chunk.text;
                controller.enqueue(
                  encodeSSE({ type: "text", delta: chunk.text }),
                );
                break;

              case "tool-call": {
                const serverName = toolSourceMap[chunk.toolName];
                toolCalls.push({
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName,
                  args: chunk.input,
                  serverName,
                });
                logger.info(
                  "[Chat API] Tool call initiated",
                  {
                    chatId,
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    args: chunk.input,
                    serverName,
                  },
                  session.user.id,
                );
                controller.enqueue(
                  encodeSSE({
                    type: "tool-call",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    args: chunk.input,
                    serverName,
                  }),
                );
                break;
              }

              case "tool-result":
                toolResults.push({
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName,
                  result: chunk.output,
                });
                logger.info(
                  "[Chat API] Tool result received",
                  {
                    chatId,
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                  },
                  session.user.id,
                );
                controller.enqueue(
                  encodeSSE({
                    type: "tool-result",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    result: chunk.output,
                  }),
                );
                break;

              case "reasoning-delta":
                fullReasoning += chunk.text;
                controller.enqueue(
                  encodeSSE({ type: "reasoning", delta: chunk.text }),
                );
                break;

              case "error":
                controller.enqueue(
                  encodeSSE({ type: "error", message: String(chunk.error) }),
                );
                break;
            }
          }
        } catch (error: any) {
          logger.error("[Chat API Error]", error, { chatId }, session.user.id);
          let message = "An error occurred during generation";
          let code = "ERROR";

          if (
            error.name === "AI_RetryError" ||
            error.name === "AI_APICallError"
          ) {
            const statusCode = error.statusCode || error.lastError?.statusCode;
            if (statusCode === 429) {
              message =
                "Too many requests. Please try again later or add your own API key.";
              code = "RATE_LIMIT";
            } else if (error.message?.includes("rate-limited")) {
              message =
                "The AI provider is temporarily rate-limited. Please try again shortly.";
              code = "RATE_LIMIT";
            }
          }

          controller.enqueue(encodeSSE({ type: "error", message, code }));
          return;
        }

        if (!fullText && toolCalls.length === 0 && !fullReasoning) {
          controller.enqueue(
            encodeSSE({ type: "error", message: "No response from model" }),
          );
          return;
        }

        const metadataObj: Record<string, unknown> = {};
        if (toolCalls.length > 0) {
          metadataObj.toolCalls = toolCalls;
          metadataObj.toolResults = toolResults;
        }
        if (fullReasoning) {
          metadataObj.reasoning = fullReasoning;
        }
        metadataObj.model = resolvedModelId;
        const metadata =
          Object.keys(metadataObj).length > 0
            ? JSON.stringify(metadataObj)
            : null;

        await db.insert(message).values({
          id: assistantMessageId,
          chatId,
          role: "assistant",
          content: fullText,
          parentId: userMessageId,
          metadata,
        });

        await db
          .update(chat)
          .set({ currentLeafId: assistantMessageId, updatedAt: new Date() })
          .where(eq(chat.id, chatId));

        logger.info(
          "[Chat API] Response completed",
          {
            chatId,
            assistantMessageId,
            textLength: fullText.length,
            toolCallsCount: toolCalls.length,
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
      } catch (_err) {
        controller.enqueue(
          encodeSSE({ type: "error", message: "Stream failed" }),
        );
      } finally {
        await mcpCleanup();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: SSE_HEADERS,
  });
}
