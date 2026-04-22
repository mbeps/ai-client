import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat, message, mcpServer, project } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image"; image: URL | string; mimeType?: string };
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const DEFAULT_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const attachmentSchema = z.object({
    id: z.string(),
    name: z.string(),
    mimeType: z.string().optional(),
    type: z.enum(["image", "document"]).optional(),
    dataUrl: z.string().optional(),
    extractedText: z.string().optional(),
    key: z.string().optional(),
  });

  const messageSchema = z
    .object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.union([z.string(), z.array(z.any())]),
      id: z.string().optional(),
      parentId: z.string().optional(),
      attachments: z.array(attachmentSchema).optional(),
    })
    .passthrough();

  const chatRequestSchema = z.object({
    chatId: z.string().min(1),
    userMessageId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    messages: z.array(messageSchema).max(500),
    selectedServerIds: z.array(z.string()).max(20).optional(),
  });

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
  } = parsed.data;

  const model = requestedModel ?? DEFAULT_MODEL;

  const [chatRow] = await db
    .select({
      id: chat.id,
      projectId: chat.projectId,
      assistantId: chat.assistantId,
    })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) return new Response("Not Found", { status: 404 });

  // Fetch project globalPrompt if this chat belongs to a project
  const projectRow = chatRow.projectId
    ? await db
        .select({ globalPrompt: project.globalPrompt })
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
      and(eq(mcpServer.userId, session.user.id), eq(mcpServer.enabled, true)),
    );

  const filteredServers =
    selectedServerIds && selectedServerIds.length > 0
      ? servers.filter((s) => selectedServerIds.includes(s.id))
      : servers;

  let mcpTools: Record<string, any> = {};
  let mcpCleanup = async () => {};
  if (filteredServers.length > 0) {
    try {
      const result = await getMcpTools(
        filteredServers as Parameters<typeof getMcpTools>[0],
      );
      mcpTools = result.tools;
      mcpCleanup = result.cleanup;
    } catch (error) {
      console.warn("[MCP] Failed to load tools:", error);
    }
  }

  const hasMcpTools = Object.keys(mcpTools).length > 0;

  const processedMessages = history.map((m) => {
    if (m.role === "user" && m.attachments && m.attachments.length > 0) {
      const parts: Array<TextPart | ImagePart> = [];

      // Add extracted document text as context
      for (const att of m.attachments) {
        if (att.type === "document" && att.extractedText) {
          parts.push({
            type: "text",
            text: `[Document: ${att.name}]\n${att.extractedText}`,
          });
        }
      }

      // Add user message text
      if (typeof m.content === "string" && m.content.trim()) {
        parts.push({ type: "text", text: m.content });
      }

      // Add images
      for (const att of m.attachments) {
        if (att.type === "image" && att.dataUrl) {
          parts.push({
            type: "image",
            image: att.dataUrl,
            mimeType: att.mimeType,
          });
        }
      }

      return {
        role: m.role,
        content:
          parts.length === 1 && parts[0].type === "text"
            ? (parts[0] as TextPart).text
            : parts,
      };
    }
    return { role: m.role, content: m.content };
  }) as ModelMessage[];

  // Prepend project global prompt as system message if present
  const systemMessages: ModelMessage[] = [];
  if (projectRow?.globalPrompt?.trim()) {
    systemMessages.push({ role: "system", content: projectRow.globalPrompt });
  }
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
  });

  const assistantMessageId = uuidv4();
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
          console.error("[Chat API Error]:", error);
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
          controller.close();
          return;
        }

        if (!fullText && toolCalls.length === 0 && !fullReasoning) {
          controller.enqueue(
            encode({ type: "error", message: "No response from model" }),
          );
          controller.close();
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
