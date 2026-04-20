import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat, message, mcpServer } from "@/drizzle/schema";
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

  const {
    chatId,
    userMessageId,
    messages: history,
    model: requestedModel,
    selectedServerIds,
  }: {
    chatId: string;
    userMessageId: string;
    model?: string;
    selectedServerIds?: string[];
    messages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
      attachments?: Array<{
        type: "image" | "document";
        dataUrl: string;
        name: string;
        mimeType: string;
        extractedText?: string;
      }>;
    }>;
  } = await req.json();

  const model = requestedModel ?? DEFAULT_MODEL;

  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) return new Response("Not Found", { status: 404 });

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

  const processedMessages: ModelMessage[] = history.map((m) => {
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
      if (m.content.trim()) {
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
  });

  // Use .chat() to force the Chat Completions API endpoint (/chat/completions)
  // rather than the OpenAI Responses API (/responses), which OpenRouter does not support.
  const result = streamText({
    model: openrouter.chat(model),
    messages: processedMessages,
    tools: hasMcpTools ? mcpTools : undefined,
    stopWhen: hasMcpTools ? stepCountIs(10) : undefined,
  });

  const assistantMessageId = uuidv4();
  let fullText = "";

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

            case "error":
              controller.enqueue(
                encode({ type: "error", message: String(chunk.error) }),
              );
              break;
          }
        }

        if (!fullText && toolCalls.length === 0) {
          controller.enqueue(
            encode({ type: "error", message: "No response from model" }),
          );
          controller.close();
          return;
        }

        const metadata =
          toolCalls.length > 0
            ? JSON.stringify({ toolCalls, toolResults })
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
