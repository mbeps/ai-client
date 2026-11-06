"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { attachment, chat, message } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { abortChatStream } from "@/lib/chat/abort-chat-stream";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { sweepOrphanedAttachmentKeys } from "@/lib/storage/sweep-orphaned-attachment-keys";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "chats"]);

/**
 * Deletes a chat and all associated messages (CASCADE) for the authenticated user.
 * Validates chatId format and enforces ownership before deletion; cascading delete removes all child messages and attachments.
 * Runs on server only — never call from client components.
 *
 * @param chatId - UUID of the chat to delete; must be owned by the authenticated user.
 * @returns Result void.
 */
export const deleteChat = defineAction(
  async (chatId: string): Promise<Result<void, CommonError>> => {
    const session = await requireSession();

    const parsedId = z.string().uuid().safeParse(chatId);
    if (!parsedId.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid chat ID format",
      });
    }
    const validatedChatId = parsedId.data;

    // Collect distinct attachment keys before rows cascade away (keys may be
    // shared with cloned messages, so deletion is refcounted afterwards)
    const keys = await db
      .selectDistinct({ key: attachment.key })
      .from(attachment)
      .innerJoin(message, eq(attachment.messageId, message.id))
      .where(eq(message.chatId, validatedChatId));

    const [deleted] = await db
      .delete(chat)
      .where(
        and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)),
      )
      .returning({ id: chat.id });

    if (!deleted) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    await abortChatStream(validatedChatId, session.user.id);

    await sweepOrphanedAttachmentKeys(keys.map((k) => k.key));

    log.info("Chat deleted successfully (id: {chatId})", {
      chatId: validatedChatId,
    });

    return ok(undefined);
  },
);
