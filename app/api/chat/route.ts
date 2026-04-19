import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

type CoreMessage = { role: "user" | "assistant" | "system"; content: string };
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL = "nvidia/nemotron-nano-9b-v2:free";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const {
    chatId,
    userMessageId,
    messages: history,
  }: {
    chatId: string;
    userMessageId: string;
    messages: CoreMessage[];
  } = await req.json();

  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) return new Response("Not Found", { status: 404 });

  // Use .chat() to force the Chat Completions API endpoint (/chat/completions)
  // rather than the OpenAI Responses API (/responses), which OpenRouter does not support.
  const result = streamText({
    model: openrouter.chat(MODEL),
    messages: history,
  });

  const assistantMessageId = uuidv4();
  let fullText = "";

  const encode = (data: object) =>
    new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          fullText += chunk;
          controller.enqueue(encode({ type: "text", delta: chunk }));
        }

        if (!fullText) {
          controller.enqueue(
            encode({ type: "error", message: "No response from model" }),
          );
          controller.close();
          return;
        }

        await db.insert(message).values({
          id: assistantMessageId,
          chatId,
          role: "assistant",
          content: fullText,
          parentId: userMessageId,
        });

        await db
          .update(chat)
          .set({ currentLeafId: assistantMessageId, updatedAt: new Date() })
          .where(eq(chat.id, chatId));

        controller.enqueue(encode({ type: "done", id: assistantMessageId }));
      } catch (_err) {
        controller.enqueue(encode({ type: "error", message: "Stream failed" }));
      } finally {
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
