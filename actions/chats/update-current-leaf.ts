"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "chats"]);

/**
 * Updates the current leaf pointer for a chat session.
 * Used when navigating between different message branches in the tree.
 *
 * @param chatId - Unique identifier of the chat.
 * @param leafId - Unique identifier of the message that is now the active tip.
 * @returns Result void.
 * @author Maruf Bepary
 */
export const updateCurrentLeaf = defineAction(
  async (
    chatId: string,
    leafId: string,
  ): Promise<Result<void, CommonError>> => {
    const session = await requireSession();

    const parsedChatId = z.string().uuid().safeParse(chatId);
    const parsedLeafId = z.string().uuid().safeParse(leafId);

    if (!parsedChatId.success || !parsedLeafId.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid UUID format",
      });
    }

    const validatedChatId = parsedChatId.data;
    const validatedLeafId = parsedLeafId.data;

    const [updated] = await db
      .update(chat)
      .set({ currentLeafId: validatedLeafId, updatedAt: new Date() })
      .where(
        and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)),
      )
      .returning({ id: chat.id });

    if (!updated) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    log.debug(
      "Updated current chat leaf pointer (chatId: {chatId}, leafId: {leafId})",
      {
        chatId: validatedChatId,
        leafId: validatedLeafId,
      },
    );

    return ok(undefined);
  },
);
