import { rm } from "fs/promises";
import { z } from "zod";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { assistant, chat, message, mcpServer, project } from "@/drizzle/schema";
import { eq, and, or } from "drizzle-orm";
import { headers } from "next/headers";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { downloadAttachmentsToTemp } from "@/lib/mcp/download-attachments-to-temp";
import { persistModifiedFiles } from "@/lib/mcp/persist-modified-files";
import { DEFAULT_MODEL } from "@/constants/models";
import { chatRequestSchema } from "@/schemas/chat";
import type { FileBridgeResult } from "@/types/file-bridge-result";
import { assembleModelMessages } from "@/lib/chat/assemble-model-messages";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: env.OPENROUTER_API_KEY,
});

/**
 * POST handler for the AI chat streaming pipeline.
 * Authenticates via Better Auth session, validates the request schema, fetches Project/Assistant system prompts from the database,
 * loads enabled MCP servers, downloads spreadsheet attachments to a temporary staging directory (via FileBridge),
 * connects to MCP servers, and streams text responses using Vercel AI SDK's `streamText` with tool support.
 * Returns a text/event-stream with content, tool calls, and file-modified events.
 *
 * AUTHENTICATION: Requires valid Better Auth session (401 if missing).
 * STREAMING: Responses are streamed via Server-Sent Events (SSE) for real-time content delivery.
 * MCP INTEGRATION: Discovers tools from enabled MCP servers; supports tool selection via `selectedTools` and `selectedServerIds`.
 * ARTIFACT SUPPORT: The internal `manage_artifact` tool is automatically added if selected; allows AI to create markdown, spreadsheet, HTML, or Mermaid artifacts.
 * FILE BRIDGE: Spreadsheet attachments from the latest user message are staged to `/tmp` and their directory is injected into stdio MCP server envs via `EXCEL_MCP_ALLOWED_DIRS`.
 *
 * @param req - Incoming POST request containing chatId, history, model, MCP server/tool selections, and attachments
 * @returns Streaming response (text/event-stream) with AI content, tool execution results, and file-modified events
 * @throws Returns 401 Unauthorized if Better Auth session is invalid or missing.
 * @throws Returns 400 Bad Request if request body fails schema validation (malformed JSON, missing chatId, invalid message format).
 * @throws Returns 404 Not Found if chatId does not exist or user does not own the chat.
 * @throws Returns error response if AI provider (OpenRouter) returns rate limit (429) or API error — sent as SSE error event.
 * @throws Returns error response if MCP tool discovery or execution fails — sent as SSE error event with details.
 * @throws Returns error response if message persistence to database fails — sent as SSE error event.
 * @throws Returns error response if FileBridge (spreadsheet staging) fails — returned as error event but continues without bridge.
 * @see getMcpTools for MCP tool discovery and connection management
 * @see downloadAttachmentsToTemp for spreadsheet staging (FileBridge)
 * @see persistModifiedFiles for tracking spreadsheet changes after MCP execution
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

  const model = requestedModel ?? DEFAULT_MODEL;

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

  // Validation: Prevent assistant mentions if chat is already bound or has history
  let finalSelectedAssistantId = selectedAssistantId;
  if (selectedAssistantId) {
    const isBoundToDifferent =
      chatRow.assistantId && chatRow.assistantId !== selectedAssistantId;
    const hasHistory = history.length > 0;

    if (isBoundToDifferent || hasHistory) {
      console.warn(
        `[Chat API] Ignoring assistant mention ${selectedAssistantId} due to ${
          isBoundToDifferent ? "bound assistant" : "existing history"
        }`,
      );
      finalSelectedAssistantId = undefined;
    }
  }

  const effectiveAssistantId = chatRow.assistantId || finalSelectedAssistantId;

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
      type: mcpServer.type,
      command: mcpServer.command,
      args: mcpServer.args,
      url: mcpServer.url,
      headers: mcpServer.headers,
      env: mcpServer.env,
    })
    .from(mcpServer)
    .where(
      and(
        or(eq(mcpServer.userId, session.user.id), eq(mcpServer.isPublic, true)),
        eq(mcpServer.enabled, true),
      ),
    );

  const filteredServers =
    selectedServerIds && selectedServerIds.length > 0
      ? servers.filter((s) => selectedServerIds.includes(s.id))
      : servers;

  // FileBridge: download spreadsheet attachments from the LATEST user message only.
  // Re-bridging the entire history every turn would be wasteful and break
  // the assumption that modified files become new attachments on later turns.
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
  const spreadsheetAtts: { id: string; key: string; name: string }[] = [];
  if (lastUserMsg?.attachments) {
    for (const att of lastUserMsg.attachments) {
      if (att.type === "spreadsheet" && att.key && att.id && att.name) {
        spreadsheetAtts.push({ id: att.id, key: att.key, name: att.name });
      }
    }
  }

  let bridge: FileBridgeResult | null = null;
  if (filteredServers.length > 0 && spreadsheetAtts.length > 0) {
    try {
      bridge = await downloadAttachmentsToTemp(spreadsheetAtts);
    } catch (err) {
      console.warn(
        "[FileBridge] Failed to download attachments, continuing without bridge:",
        err,
      );
    }
  }

  // Inject EXCEL_MCP_ALLOWED_DIRS into stdio MCP server envs when FileBridge is active
  const scopedServers = bridge
    ? filteredServers.map((s) => {
        if (s.type !== "stdio") return s;
        const userEnv = s.env
          ? (JSON.parse(s.env) as Record<string, string>)
          : {};
        return {
          ...s,
          env: JSON.stringify({
            ...userEnv,
            EXCEL_MCP_ALLOWED_DIRS: bridge!.tempDir,
          }),
        };
      })
    : filteredServers;

  const isArtifactToolSelected = selectedTools?.includes(
    "internal:tool:manage_artifact",
  );

  const { mcpTools, mcpCleanup } = await registerMcpTools(
    scopedServers as any,
    selectedTools,
    !!isArtifactToolSelected,
    activeKbId,
  );

  const hasMcpTools = Object.keys(mcpTools).length > 0;

  const processedMessages = assembleModelMessages(history, bridge);

  const systemMessages = buildSystemPrompt(
    globalSystemPrompt,
    projectRow?.globalPrompt,
    assistantRow?.prompt,
    bridge,
    !!activeKbId,
  );
  const finalMessages: ModelMessage[] = [
    ...systemMessages,
    ...processedMessages,
  ];

  // Use .chat() to force the Chat Completions API endpoint (/chat/completions)
  // rather than the OpenAI Responses API (/responses), which OpenRouter does not support.
  const result = streamText({
    model: openrouter.chat(model),
    messages: finalMessages,
    tools: hasMcpTools ? mcpTools : undefined,
    stopWhen: hasMcpTools ? stepCountIs(10) : undefined,
    abortSignal: req.signal,
  });

  const assistantMessageId = crypto.randomUUID();
  let fullText = "";
  let fullReasoning = "";

  const encode = (data: object) =>
    new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const toolCalls: {
          toolCallId: string;
          toolName: string;
          args: unknown;
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
                controller.enqueue(encode({ type: "text", delta: chunk.text }));
                break;

              case "tool-call":
                toolCalls.push({
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName,
                  args: chunk.input,
                });
                logger.info(
                  "[Chat API] Tool call initiated",
                  {
                    chatId,
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    args: chunk.input,
                  },
                  session.user.id,
                );
                controller.enqueue(
                  encode({
                    type: "tool-call",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    args: chunk.input,
                  }),
                );
                break;

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
                  encode({
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
                  encode({ type: "reasoning", delta: chunk.text }),
                );
                break;

              case "error":
                controller.enqueue(
                  encode({ type: "error", message: String(chunk.error) }),
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

          controller.enqueue(encode({ type: "error", message, code }));
          return;
        }

        if (!fullText && toolCalls.length === 0 && !fullReasoning) {
          controller.enqueue(
            encode({ type: "error", message: "No response from model" }),
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
        metadataObj.model = model;
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

        if (bridge) {
          try {
            const modified = await persistModifiedFiles({
              files: bridge.files,
              userId: session.user.id,
              messageId: assistantMessageId,
            });
            for (const mod of modified) {
              controller.enqueue(
                encode({
                  type: "file-modified",
                  attachmentId: mod.newAttachmentId,
                  messageId: assistantMessageId,
                  name: mod.name,
                  mimeType: mod.mimeType,
                  size: mod.size,
                }),
              );
            }
          } catch (err) {
            console.warn("[FileBridge] Failed to persist modified files:", err);
            controller.enqueue(
              encode({
                type: "error",
                message: "Failed to save modified spreadsheet(s)",
                code: "BRIDGE_PERSIST_FAILED",
              }),
            );
          }
        }

        controller.enqueue(
          encode({
            type: "done",
            id: assistantMessageId,
            metadata: metadata ? JSON.parse(metadata) : undefined,
          }),
        );
      } catch (_err) {
        controller.enqueue(encode({ type: "error", message: "Stream failed" }));
      } finally {
        if (bridge) {
          await rm(bridge.tempDir, { recursive: true, force: true }).catch(
            (err) => console.warn("[FileBridge] Temp cleanup failed:", err),
          );
        }
        await mcpCleanup();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
