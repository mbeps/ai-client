import { db } from "@/drizzle/db";
import { chat, message, attachment } from "@/drizzle/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/storage/get-presigned-url";
import { ChatNotFoundError } from "@/lib/chat/load-chat-context";

/**
 * A single message in the server-loaded thread, with presigned attachment URLs.
 * @author Maruf Bepary
 */
export type ThreadAttachment = {
  id: string;
  name: string;
  url: string;
  type: string;
  /** S3 object key — used by the get_file_url tool for on-demand resolution. */
  key: string;
  extractedText?: string | null;
};

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parentId: string | null;
  metadata: string | null;
  createdAt: Date;
  attachments?: ThreadAttachment[];
};

/**
 * Loads the active conversation branch for a chat directly from the database.
 * The client no longer sends message history — this is the trust boundary:
 *
 * 1. Verifies chat ownership (user-scoped lookup) — IDOR protection.
 * 2. Fetches all messages for the chat ordered by creation time.
 * 3. Walks the parentId chain from `userMessageId` up to the root, then
 *    reverses it so the thread reads root → leaf (the active branch only).
 * 4. Loads attachments for the branch's messages scoped by userId and signs
 *    presigned download URLs.
 *
 * @param chatId - Chat UUID
 * @param userMessageId - The leaf message id (the user's latest message)
 * @param userId - Authenticated user id for authorization scoping
 * @returns Thread messages ordered root → leaf, each with signed attachments
 * @throws {ChatNotFoundError} When the chat doesn't exist or belongs to another user
 * @throws {Error} When `userMessageId` isn't part of the chat
 * @author Maruf Bepary
 */
export async function loadThreadFromDb(
  chatId: string,
  userMessageId: string,
  userId: string,
): Promise<ThreadMessage[]> {
  // 1. Ownership check — a missing row means "not yours or doesn't exist"
  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));

  if (!chatRow) throw new ChatNotFoundError(chatId);

  // 2. All messages for the chat (branch walk happens in memory)
  const rows = await db
    .select({
      id: message.id,
      role: message.role,
      content: message.content,
      parentId: message.parentId,
      metadata: message.metadata,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(asc(message.createdAt));

  // 3. Walk parentId chain from leaf up to root, then reverse
  const byId = new Map(rows.map((r) => [r.id, r]));
  const leaf = byId.get(userMessageId);
  if (!leaf) {
    throw new Error(`Message '${userMessageId}' not found in chat '${chatId}'`);
  }

  const branch: typeof rows = [];
  let cursor = leaf as (typeof rows)[number] | undefined;
  const seen = new Set<string>(); // ponytail: guards against corrupt self-referential cycles; upgrade path: DB-level cycle constraint
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    branch.push(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  branch.reverse();

  // 4. Attachments for branch messages, scoped to the requesting user
  const messageIds = branch.map((m) => m.id);
  if (messageIds.length > 0) {
    const attRows = await db
      .select({
        id: attachment.id,
        messageId: attachment.messageId,
        name: attachment.name,
        mimeType: attachment.mimeType,
        key: attachment.key,
        extractedText: attachment.extractedText,
      })
      .from(attachment)
      .where(
        and(
          inArray(attachment.messageId, messageIds),
          eq(attachment.userId, userId),
        ),
      );

    const byMessage = new Map<string, ThreadAttachment[]>();
    await Promise.all(
      attRows.map(async (a) => {
        if (a.messageId === null) return;
        const type = typeFromMime(a.mimeType);
        // Only images need eager presigned URLs (vision model messages);
        // other types are resolved on demand via the get_file_url tool.
        const url = type === "image" ? await getPresignedUrl(a.key) : "";
        const list = byMessage.get(a.messageId) ?? [];
        list.push({
          id: a.id,
          name: a.name,
          url,
          type,
          key: a.key,
          extractedText: a.extractedText,
        });
        byMessage.set(a.messageId, list);
      }),
    );

    for (const m of branch) {
      const atts = byMessage.get(m.id);
      if (atts) (m as ThreadMessage).attachments = atts;
    }
  }

  return branch as ThreadMessage[];
}

/**
 * Maps a stored MIME type to the coarse attachment type used by the UI.
 * @author Maruf Bepary
 */
function typeFromMime(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  ) {
    return "spreadsheet";
  }
  return "document";
}
