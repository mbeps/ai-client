import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { attachment, chat, message } from "@/drizzle/schemas/chat-schema";
import { ChatNotFoundError } from "@/lib/chat/load-chat-context";
import { downloadObject } from "@/lib/storage/download-object";
import { getPresignedUrl } from "@/lib/storage/get-presigned-url";

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

/**
 * Represents thread message.
 *
 * @author Maruf Bepary
 */
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
      // Only images need eager URLs for vision model messages; convert localhost
      // S3 endpoints to base64 so external cloud LLMs can view local images.
      const url =
        type === "image" ? await resolveImageUrl(a.key, a.mimeType) : "";
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

  return branch as ThreadMessage[];
}

/**
 * Maps a stored MIME type to the coarse attachment type used by the UI.
 *
 * @param mimeType - Target mime type
 * @returns The resolved result
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

/**
 * Checks whether a URL targets a local or private address unreachable from cloud LLMs.
 *
 * @param urlStr - URL string to check
 * @returns True if the URL points to localhost or private network address
 */
function isLocalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".localhost") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

/**
 * Resolves an image attachment URL for model consumption.
 * When S3 is on a local/private endpoint (e.g. MinIO in development),
 * inlines the image as a base64 data URL so cloud vision models can access it.
 *
 * @param key - S3 object key
 * @param mimeType - Image MIME type
 * @returns Base64 data URL or presigned remote URL
 */
async function resolveImageUrl(key: string, mimeType: string): Promise<string> {
  const presigned = await getPresignedUrl(key);
  if (isLocalUrl(presigned)) {
    try {
      const buffer = await downloadObject(key);
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    } catch {
      return presigned;
    }
  }
  return presigned;
}
