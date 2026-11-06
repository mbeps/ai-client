"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schemas/chat-schema";
import { subagentScratchpad } from "@/drizzle/schemas/subagent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

export type ScratchpadFile = {
  id: string;
  filePath: string;
  content: string;
  writtenByRole: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Server action to fetch all scratchpad files for a specific assistant message.
 * Enforces authenticated session and user ownership of the parent chat.
 *
 * @param chatIdOrMessageId - Either the chatId (when messageId is supplied) or the messageId alone
 * @param messageId - Optional assistant message UUID if chatId was provided as first argument
 * @returns Result wrapping array of scratchpad records associated with the message
 * @author Maruf Bepary
 */
export const getScratchpadFilesAction = defineAction(
  async (
    chatIdOrMessageId: string,
    messageId?: string,
  ): Promise<Result<ScratchpadFile[], CommonError>> => {
    const session = await requireSession();
    const userId = session.user.id;

    let effectiveChatId: string | null = null;
    let effectiveMessageId: string | null = null;

    if (messageId !== undefined) {
      effectiveChatId = chatIdOrMessageId;
      effectiveMessageId = messageId;
    } else {
      // 1-argument mode: backward compatibility
      effectiveMessageId = chatIdOrMessageId;
    }

    // If effectiveMessageId is "streaming" or empty, return [] safely without error
    if (!effectiveMessageId || effectiveMessageId === "streaming") {
      return ok([]);
    }

    if (effectiveChatId) {
      const [chatRow] = await db
        .select({ id: chat.id })
        .from(chat)
        .where(and(eq(chat.id, effectiveChatId), eq(chat.userId, userId)))
        .limit(1);

      if (!chatRow) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Chat not found or access denied.",
        });
      }
    } else {
      // 1-argument mode: verify via message and chat join
      const [msg] = await db
        .select({
          id: message.id,
          chatId: message.chatId,
        })
        .from(message)
        .innerJoin(chat, eq(chat.id, message.chatId))
        .where(and(eq(message.id, effectiveMessageId), eq(chat.userId, userId)))
        .limit(1);

      if (!msg) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Message not found or access denied.",
        });
      }
      effectiveChatId = msg.chatId;
    }

    const whereClause = and(
      eq(subagentScratchpad.chatId, effectiveChatId),
      eq(subagentScratchpad.messageId, effectiveMessageId),
    );

    // Fetch full details of scratchpad files for the viewer
    const files = await db
      .select({
        id: subagentScratchpad.id,
        filePath: subagentScratchpad.filePath,
        content: subagentScratchpad.content,
        writtenByRole: subagentScratchpad.writtenByRole,
        version: subagentScratchpad.version,
        createdAt: subagentScratchpad.createdAt,
        updatedAt: subagentScratchpad.updatedAt,
      })
      .from(subagentScratchpad)
      .where(whereClause)
      .orderBy(subagentScratchpad.filePath);

    return ok(files);
  },
);
