import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { env } from "@/config/env";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { auth } from "@/lib/auth/auth";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { chatRequestSchema } from "@/schemas/chat/chat";

const log = getLogger(["app", "api", "chat"]);

/**
 * Maximum execution timeout in seconds for chat request dispatch.
 *
 * @author Maruf Bepary
 */
export const maxDuration = 60;

/**
 * Dispatches AI chat response generation as an Inngest background job.
 * Checks authentication, validates payload schema, and publishes chat execution event.
 *
 * @param req - Incoming HTTP request with chat request payload
 * @returns JSON response with dispatch status and identifiers, or error response
 * @author Maruf Bepary
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    log.warn("Invalid chat request: {details}", {
      details: parsed.error.flatten(),
    });
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    chatId,
    userMessageId,
    model: requestedModel,
    selectedServerIds,
    selectedTools,
    selectedAssistantId,
    selectedSkillIds,
    selectedKbIds,
    subagentsEnabled,
    subagentModelId,
  } = parsed.data;

  // Ensure model is undefined if empty or whitespace-only
  const model =
    requestedModel && requestedModel.trim() !== "" ? requestedModel : undefined;
  const userId = session.user.id;

  const rateLimit = checkRateLimit(`chat:${userId}`, env.RATE_LIMIT_CHAT_RPM);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));

  if (!chatRow) {
    log.warn(
      "Chat not found or access denied (chatId: {chatId}, userId: {userId})",
      { chatId, userId },
    );
    return Response.json(
      { error: "Chat not found or access denied" },
      { status: 404 },
    );
  }

  try {
    await inngest.send({
      name: "chat/response.generate",
      data: {
        chatId,
        userId,
        userName: session.user.name,
        userEmail: session.user.email,
        userMessageId,
        model,
        selectedServerIds,
        selectedTools,
        selectedAssistantId,
        selectedSkillIds,
        selectedKbIds,
        subagentsEnabled: subagentsEnabled ?? false,
        subagentModelId,
      },
    });

    return Response.json({ success: true, chatId, userMessageId });
  } catch (error: unknown) {
    log.error("Chat dispatch failed (chatId: {chatId}): {error}", {
      chatId,
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return Response.json(
      { error: "An internal error occurred." },
      { status: 500 },
    );
  }
}
