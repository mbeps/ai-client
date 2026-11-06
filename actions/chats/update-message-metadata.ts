"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Updates message metadata after validating user ownership of chat.
 *
 * @param messageId - Message identifier to update
 * @param metadata - New metadata JSON string or null
 * @returns Result void.
 * @author Maruf Bepary
 */
export const updateMessageMetadata = defineAction(
  async (
    messageId: string,
    metadata: string | null,
  ): Promise<Result<void, CommonError>> => {
    const session = await requireSession();

    // Ensure the message belongs to a chat owned by the user
    const [row] = await db
      .select({
        messageId: message.id,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(and(eq(message.id, messageId), eq(chat.userId, session.user.id)));

    if (!row) {
      return fail({
        code: ERROR_CODE.UNAUTHORIZED,
        message: "Unauthorized",
      });
    }

    await db.update(message).set({ metadata }).where(eq(message.id, messageId));

    return ok(undefined);
  },
);
