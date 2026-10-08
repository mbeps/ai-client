"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { chat, message, subagentScratchpad } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { listScratchpadFiles } from "@/lib/subagents/scratchpad-service";

/**
 * Server action to fetch all scratchpad files for a specific assistant message.
 * Enforces authenticated session and user ownership of the parent chat.
 *
 * @author Maruf Bepary
 */
export async function getScratchpadFilesAction(
  chatIdOrMessageId: string,
  messageId?: string,
) {
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
    return [];
  }

  if (effectiveChatId) {
    const [chatRow] = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.id, effectiveChatId), eq(chat.userId, userId)))
      .limit(1);

    if (!chatRow) {
      throw new Error("Chat not found or access denied.");
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
      throw new Error("Message not found or access denied.");
    }
    effectiveChatId = msg.chatId;
  }

  const whereClause = effectiveChatId
    ? and(
        eq(subagentScratchpad.chatId, effectiveChatId),
        eq(subagentScratchpad.messageId, effectiveMessageId),
      )
    : eq(subagentScratchpad.messageId, effectiveMessageId);

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

  return files;
}
