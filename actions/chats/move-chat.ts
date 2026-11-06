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
import { moveChatSchema } from "@/schemas/chat/chat";
import type { ChatRow } from "@/types/chat/chat-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "chats"]);

/**
 * Moves a chat to a specific project or removes it from all projects.
 *
 * @param chatId - Unique identifier of the chat.
 * @param projectId - ID of the target project, or null to dissociate from all projects.
 * @returns Result containing the updated chat record.
 * @author Maruf Bepary
 */
export const moveChat = defineAction(
  async (
    chatId: string,
    projectId: string | null,
  ): Promise<Result<ChatRow, CommonError>> => {
    const session = await requireSession();

    const parsedChatId = z.string().uuid().safeParse(chatId);
    const parsedData = moveChatSchema.safeParse({ projectId });

    if (!parsedChatId.success || !parsedData.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid UUID format",
      });
    }

    const validatedChatId = parsedChatId.data;
    const validatedData = parsedData.data;

    const [updatedChat] = await db
      .update(chat)
      .set({ projectId: validatedData.projectId, updatedAt: new Date() })
      .where(
        and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)),
      )
      .returning();

    if (!updatedChat) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    log.info("Moved chat {chatId} to project {projectId}", {
      chatId: validatedChatId,
      projectId: validatedData.projectId,
    });

    return ok(updatedChat);
  },
);
