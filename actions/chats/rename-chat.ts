"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { renameChatSchema } from "@/schemas/chat/chat";
import type { ChatRow } from "@/types/chat/chat-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Renames a chat with ownership check.
 *
 * @param chatId - The ID of the chat to rename.
 * @param title - The new title for the chat.
 * @returns Result containing the updated chat record.
 * @author Maruf Bepary
 */
export const renameChat = defineAction(
  async (
    chatId: string,
    title: string,
  ): Promise<Result<ChatRow, CommonError>> => {
    const session = await requireSession();

    const parsedChatId = z.string().uuid().safeParse(chatId);
    const parsedTitle = renameChatSchema.safeParse({ title });

    if (!parsedChatId.success || !parsedTitle.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid input",
      });
    }

    const validatedChatId = parsedChatId.data;
    const { title: validatedTitle } = parsedTitle.data;

    const [updated] = await db
      .update(chat)
      .set({ title: validatedTitle, updatedAt: new Date() })
      .where(
        and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)),
      )
      .returning();

    if (!updated) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(updated);
  },
);
