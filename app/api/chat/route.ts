import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { env } from "@/config/env";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { auth } from "@/lib/auth/auth";
import { ERROR_CODE } from "@/lib/error/error-code";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { chatRequestSchema } from "@/schemas/chat/chat";

const log = getLogger(["app", "api", "chat"]);

/**
 * Route segment configuration.
 *
 * @author Maruf Bepary
 */
export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dispatches AI chat response generation as an Inngest background job.
 * Checks authentication, validates payload schema, and publishes chat execution event.
 *
 * @param req - Incoming HTTP request with chat request payload
 * @returns JSON response with dispatch status and identifiers, or error response
 * @author Maruf Bepary
 */
export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return Response.json(
        { error: "Unauthorized", code: ERROR_CODE.UNAUTHORIZED },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON payload", code: ERROR_CODE.INVALID_INPUT },
        { status: 400 },
      );
    }

    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      log.warn("Invalid chat request: {details}", {
        details: parsed.error.flatten(),
      });
      return Response.json(
        {
          error: "Invalid request",
          code: ERROR_CODE.INVALID_INPUT,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      chatId,
      userMessageId,
      model: requestedModel,
      reasoningEffort,
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
      requestedModel && requestedModel.trim() !== ""
        ? requestedModel
        : undefined;
    const userId = session.user.id;

    const rateLimit = checkRateLimit(`chat:${userId}`, env.RATE_LIMIT_CHAT_RPM);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Rate limit exceeded", code: ERROR_CODE.RATE_LIMIT },
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
        {
          error: "Chat not found or access denied",
          code: ERROR_CODE.NOT_FOUND,
        },
        { status: 404 },
      );
    }

    await inngest.send({
      name: "chat/response.generate",
      data: {
        chatId,
        userId,
        userName: session.user.name,
        userEmail: session.user.email,
        userMessageId,
        model,
        reasoningEffort,
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
    const ref = crypto.randomUUID().slice(0, 8);
    log.error("Chat dispatch failed (ref: {ref}): {error}", {
      ref,
      error: error instanceof Error ? (error.stack ?? error.message) : error,
    });
    return Response.json(
      {
        error: `An internal error occurred. (Ref: ${ref})`,
        code: ERROR_CODE.INTERNAL,
        ref,
      },
      { status: 500 },
    );
  }
}
