import { headers } from "next/headers";
import { env } from "@/config/env";
import { auth } from "@/lib/auth/auth";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { chatRequestSchema } from "@/schemas/chat/chat";

const log = getLogger(["app", "api", "chat"]);

export const maxDuration = 60;

/**
 * Dispatches AI chat response generation as an Inngest background job.
 * Checks authentication, rate limiting, and request payload schema before dispatching.
 *
 * **HTTP Method:** POST
 *
 * **Request Format:** JSON with chatId, userMessageId, model?, selectedServerIds?,
 * selectedTools?, selectedAssistantId?, selectedKbIds?
 *
 * **Response Format:** JSON { success: true, chatId, userMessageId }
 *
 * **Authentication:** Required (Better Auth session)
 *
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

  try {
    await inngest.send({
      name: "chat/response.generate",
      data: {
        chatId,
        userId,
        userMessageId,
        model,
        selectedServerIds,
        selectedTools,
        selectedAssistantId,
        selectedSkillIds,
        selectedKbIds,
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
