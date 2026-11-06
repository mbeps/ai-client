"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { attachment, chat, message } from "@/drizzle/schemas/chat-schema";
import { subagentScratchpad } from "@/drizzle/schemas/subagent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { abortChatStream } from "@/lib/chat/abort-chat-stream";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { sweepOrphanedAttachmentKeys } from "@/lib/storage/sweep-orphaned-attachment-keys";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "messages"]);

/**
 * Recursively deletes a message and all its children/descendants from the tree.
 * Bulk deletes the collected IDs and updates the chat's current leaf tip.
 *
 * @param chatId - The ID of the chat containing the message.
 * @param messageId - The ID of the message to delete.
 * @param newLeafId - The new leaf node ID to set as current for the chat.
 * @returns Result void.
 */
export const deleteMessage = defineAction(
  async (
    chatId: string,
    messageId: string,
    newLeafId: string | null,
  ): Promise<Result<void, CommonError>> => {
    const session = await requireSession();

    const parsedChatId = z.string().uuid().safeParse(chatId);
    const parsedMessageId = z.string().uuid().safeParse(messageId);
    const parsedNewLeafId = z.string().uuid().nullable().safeParse(newLeafId);

    if (
      !parsedChatId.success ||
      !parsedMessageId.success ||
      !parsedNewLeafId.success
    ) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid UUID format",
      });
    }

    const validatedChatId = parsedChatId.data;
    const validatedMessageId = parsedMessageId.data;
    const validatedNewLeafId = parsedNewLeafId.data;

    // Verify chat ownership
    const [chatRow] = await db
      .select({ id: chat.id, currentLeafId: chat.currentLeafId })
      .from(chat)
      .where(
        and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)),
      );

    if (!chatRow) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    // Fetch all message stubs (id + parentId) for the chat to build the subtree
    const allMessages = await db
      .select({ id: message.id, parentId: message.parentId })
      .from(message)
      .where(eq(message.chatId, validatedChatId));

    // Build a children map: parentId → childIds[]
    const childrenMap = new Map<string, string[]>();
    for (const m of allMessages) {
      if (m.parentId) {
        const existing = childrenMap.get(m.parentId) ?? [];
        existing.push(m.id);
        childrenMap.set(m.parentId, existing);
      }
    }

    // Collect the target message and ALL its descendants (depth-first)
    const toDelete: string[] = [];
    const collect = (id: string) => {
      toDelete.push(id);
      for (const childId of childrenMap.get(id) ?? []) {
        collect(childId);
      }
    };
    collect(validatedMessageId);

    const affectsCurrentLeaf =
      chatRow.currentLeafId != null && toDelete.includes(chatRow.currentLeafId);

    if (chatAbortRegistry.has(validatedChatId)) {
      log.info(
        "Aborting active stream due to message deletion (chatId: {chatId}, messageId: {messageId}, affectsLeaf: {affectsLeaf})",
        {
          chatId: validatedChatId,
          messageId: validatedMessageId,
          affectsLeaf: affectsCurrentLeaf,
        },
      );
      await abortChatStream(validatedChatId, session.user.id);
    }

    const keys = await db
      .selectDistinct({ key: attachment.key })
      .from(attachment)
      .where(inArray(attachment.messageId, toDelete));

    await db
      .delete(subagentScratchpad)
      .where(inArray(subagentScratchpad.messageId, toDelete));
    await db.delete(message).where(inArray(message.id, toDelete));

    await db
      .update(chat)
      .set({ currentLeafId: validatedNewLeafId, updatedAt: new Date() })
      .where(eq(chat.id, validatedChatId));

    await sweepOrphanedAttachmentKeys(keys.map((k) => k.key));

    log.info(
      "Message and descendants deleted (deletedCount: {count}, messageId: {messageId}, chatId: {chatId})",
      {
        count: toDelete.length,
        messageId: validatedMessageId,
        chatId: validatedChatId,
      },
    );

    return ok(undefined);
  },
);
