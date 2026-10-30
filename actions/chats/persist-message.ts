"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { getLogger } from "@/lib/logger";
import { persistMessageSchema } from "@/schemas/chat/chat";
import type { MessageRow } from "@/types/message/message-row";

const log = getLogger(["app", "actions", "messages"]);

/**
 * Type representing a tool call or result item with optional server attribution.
 */
type ToolMetaItem = { toolCallId: string; serverName?: string };

/**
 * Type guard verifying an unknown item contains a valid toolCallId string.
 */
function isToolMetaItem(item: unknown): item is ToolMetaItem {
  return Boolean(
    item &&
      typeof item === "object" &&
      "toolCallId" in item &&
      typeof (item as { toolCallId: unknown }).toolCallId === "string",
  );
}

/**
 * Merges incoming metadata with existing message metadata on conflict,
 * preserving existing model ID and serverName if omitted in incoming.
 *
 * @param existingMetadataRaw - Existing JSON metadata from database
 * @param incomingMetadataRaw - Newly provided JSON metadata
 * @returns Merged JSON metadata string or null
 * @author Maruf Bepary
 */
function mergeConflictMetadata(
  existingMetadataRaw: string | null | undefined,
  incomingMetadataRaw: string | null | undefined,
): string | null {
  if (!existingMetadataRaw) return incomingMetadataRaw ?? null;
  if (!incomingMetadataRaw) return existingMetadataRaw;

  try {
    const existingMeta = JSON.parse(existingMetadataRaw);
    const incomingMeta = JSON.parse(incomingMetadataRaw);

    // Preserve non-empty model if incoming model is empty/falsy
    if (!incomingMeta.model && existingMeta.model) {
      incomingMeta.model = existingMeta.model;
    }

    // Preserve serverName on toolCalls if missing in incoming
    if (
      Array.isArray(existingMeta.toolCalls) &&
      Array.isArray(incomingMeta.toolCalls)
    ) {
      const existingTools = new Map<string, ToolMetaItem>(
        existingMeta.toolCalls
          .filter(isToolMetaItem)
          .map((tc: ToolMetaItem) => [tc.toolCallId, tc]),
      );
      for (const tc of incomingMeta.toolCalls) {
        if (isToolMetaItem(tc)) {
          const matched = existingTools.get(tc.toolCallId);
          if (!tc.serverName && matched?.serverName) {
            tc.serverName = matched.serverName;
          }
        }
      }
    }

    // Preserve serverName on toolResults if missing in incoming
    if (
      Array.isArray(existingMeta.toolResults) &&
      Array.isArray(incomingMeta.toolResults)
    ) {
      const existingResults = new Map<string, ToolMetaItem>(
        existingMeta.toolResults
          .filter(isToolMetaItem)
          .map((tr: ToolMetaItem) => [tr.toolCallId, tr]),
      );
      for (const tr of incomingMeta.toolResults) {
        if (isToolMetaItem(tr)) {
          const matched = existingResults.get(tr.toolCallId);
          if (!tr.serverName && matched?.serverName) {
            tr.serverName = matched.serverName;
          }
        }
      }
    }

    return JSON.stringify(incomingMeta);
  } catch {
    return incomingMetadataRaw;
  }
}

/**
 * Persists a message to the database with ownership check.
 * Validates input using Zod before insertion.
 *
 * @param chatId - The ID of the chat the message belongs to.
 * @param msg - The message data to persist.
 * @returns The persisted message row.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if chatId is not a valid UUID format.
 * @throws ZodError if message data fails schema validation (invalid role, content, etc.).
 * @throws Error if chat does not exist or user does not own it (ownership check enforced via session).
 * @throws Error if database insertion fails due to constraints or connection issues.
 */
export async function persistMessage(
  chatId: string,
  msg: z.infer<typeof persistMessageSchema>,
): Promise<MessageRow> {
  const session = await requireSession();

  // Validate inputs
  const validatedChatId = z.string().uuid().parse(chatId);
  const validatedMsg = persistMessageSchema.parse(msg);

  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)));

  if (!chatRow) throw new Error("Not Found");

  const existingRows = await db
    .select({
      id: message.id,
      metadata: message.metadata,
    })
    .from(message)
    .where(eq(message.id, validatedMsg.id));

  const existingMessage = Array.isArray(existingRows) ? existingRows[0] : null;
  const metadataToSave = mergeConflictMetadata(
    existingMessage?.metadata,
    validatedMsg.metadata,
  );

  const [newMessage] = await db
    .insert(message)
    .values({
      id: validatedMsg.id,
      chatId: validatedChatId,
      role: validatedMsg.role,
      content: validatedMsg.content,
      parentId: validatedMsg.parentId,
      metadata: metadataToSave,
    })
    .onConflictDoUpdate({
      target: message.id,
      set: {
        content: validatedMsg.content,
        metadata: metadataToSave,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db
    .update(chat)
    .set({ currentLeafId: newMessage.id, updatedAt: new Date() })
    .where(eq(chat.id, validatedChatId));

  log.info("Message persisted (id: {id}, chatId: {chatId}, role: {role})", {
    id: newMessage.id,
    chatId: validatedChatId,
    role: newMessage.role,
  });

  return newMessage as MessageRow;
}
