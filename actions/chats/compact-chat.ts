"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { compactChatThread } from "@/lib/chat/compact-chat-thread";
import { loadThreadFromDb } from "@/lib/chat/load-thread-from-db";
import { mapMessageFromDb } from "@/lib/chat/map-message-from-db";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { compactChatSchema } from "@/schemas/chat/chat";

/**
 * Manually compacts a chat conversation's active branch into a system checkpoint summary.
 *
 * @author Maruf Bepary
 */
export const compactChat = defineAction(async (rawInput: unknown) => {
  const session = await requireSession();
  const parsed = compactChatSchema.safeParse(rawInput);

  if (!parsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Invalid compaction request",
    });
  }

  const { chatId } = parsed.data;

  const [chatRow] = await db
    .select({
      id: chat.id,
      currentLeafId: chat.currentLeafId,
    })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)))
    .limit(1);

  if (!chatRow) {
    throw new AppException({
      code: ERROR_CODE.NOT_FOUND,
      message: "Chat not found",
    });
  }

  if (!chatRow.currentLeafId) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "No Messages To Compact",
    });
  }

  const thread = await loadThreadFromDb(
    chatId,
    chatRow.currentLeafId,
    session.user.id,
  );

  const resolved = await resolveDefaultChatProvider(session.user.id);

  const result = await compactChatThread({
    chatId,
    userId: session.user.id,
    thread,
    resolved,
    auto: false,
  });

  return ok({
    message: mapMessageFromDb(result.message, []),
    compactedCount: result.compactedCount,
    originalTokens: result.originalTokens,
    compactedTokens: result.compactedTokens,
  });
});
