"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schemas/assistant-schema";
import { attachment, chat, message } from "@/drizzle/schemas/chat-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { ChatWithMessages } from "@/types/chat/chat-with-messages";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Fetches a single chat with all messages and attachments for the authenticated user.
 * Performs left joins to optionally include project and assistant names, but excludes large prompt fields to minimise network payload.
 * Runs on server only; enforces ownership check via session validation.
 *
 * @param chatId - The UUID of the chat to retrieve; must be owned by the authenticated user.
 * @returns Result containing chat row with nested messages array and attachments array, plus optional project/assistant metadata.
 */
export const getChat = defineAction(
  async (chatId: string): Promise<Result<ChatWithMessages, CommonError>> => {
    const session = await requireSession();

    const [chatRow] = await db
      .select({
        chat: chat,
        projectName: project.name,
        assistantName: assistant.name,
      })
      .from(chat)
      .leftJoin(project, eq(chat.projectId, project.id))
      .leftJoin(assistant, eq(chat.assistantId, assistant.id))
      .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

    if (!chatRow) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    const messages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(asc(message.createdAt));

    const messageIds = messages.map((m) => m.id);
    const attachments =
      messageIds.length > 0
        ? await db
            .select()
            .from(attachment)
            .where(inArray(attachment.messageId, messageIds))
        : [];

    return ok({
      ...chatRow.chat,
      messages,
      attachments,
      projectName: chatRow.projectName ?? undefined,
      assistantName: chatRow.assistantName ?? undefined,
    });
  },
);
