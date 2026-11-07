import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { auth } from "@/lib/auth/auth";
import { abortChatStream } from "@/lib/chat/abort-chat-stream";
import { ERROR_CODE } from "@/lib/error/error-code";
import { getLogger } from "@/lib/logger";
import { stopChatRequestSchema } from "@/schemas/chat/chat";

const log = getLogger(["app", "api", "chat", "stop"]);

/**
 * Route segment configuration.
 *
 * @author Maruf Bepary
 */
export const maxDuration = 30;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cancels an in-progress AI chat response generation.
 * Immediately aborts the active stream via ChatAbortRegistry, publishes a finish event
 * to Inngest Realtime to close connected clients, and sends a cancellation event.
 *
 * @param req - Incoming HTTP DELETE request containing the target chatId
 * @returns JSON response indicating whether cancellation succeeded
 * @author Maruf Bepary
 */
export async function DELETE(req: Request) {
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

    const parsed = stopChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request",
          code: ERROR_CODE.INVALID_INPUT,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { chatId } = parsed.data;
    const userId = session.user.id;

    const [chatRow] = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));

    if (!chatRow) {
      return Response.json(
        {
          error: "Chat not found or access denied",
          code: ERROR_CODE.NOT_FOUND,
        },
        { status: 404 },
      );
    }

    const abortedLocally = await abortChatStream(chatId, userId);

    log.info(
      "Stop processed (chatId: {chatId}, abortedLocally: {abortedLocally})",
      {
        chatId,
        abortedLocally,
      },
    );

    return Response.json({ success: true, aborted: abortedLocally });
  } catch (error: unknown) {
    const ref = crypto.randomUUID().slice(0, 8);
    log.error("Stop request failed (ref: {ref}): {error}", {
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
