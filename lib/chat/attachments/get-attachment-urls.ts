import { getPresignedUrl } from "@/lib/storage/get-presigned-url";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { type ChatMessage } from "@/schemas/chat/chat";

/**
 * Extracts attachments from the latest user message and generates presigned URLs
 * only for attachments the requesting user owns (IDOR protection via DB lookup).
 *
 * @param history The chat history
 * @param userId  The authenticated user — only their attachments are signed
 * @returns A promise resolving to an array of { name, url } for owned attachments
 */
export async function getAttachmentUrls(
  history: ChatMessage[],
  userId: string,
) {
  const lastUserMessage = history.filter((m) => m.role === "user").pop();
  const messageAttachments =
    lastUserMessage?.attachments?.filter(
      (a: NonNullable<ChatMessage["attachments"]>[number]) => a.key,
    ) ?? [];

  if (messageAttachments.length === 0) return [];

  const clientKeys = messageAttachments.map((a) => a.key!);

  // Verify ownership — only sign URLs for keys the requesting user actually owns
  const ownedRows = await db
    .select({ key: attachment.key, name: attachment.name })
    .from(attachment)
    .where(
      and(inArray(attachment.key, clientKeys), eq(attachment.userId, userId)),
    );

  const ownedKeySet = new Set(ownedRows.map((r) => r.key));

  return Promise.all(
    messageAttachments
      .filter((a) => ownedKeySet.has(a.key!))
      .map(async (a: NonNullable<ChatMessage["attachments"]>[number]) => {
        const url = await getPresignedUrl(a.key!);
        return { name: a.name, url };
      }),
  );
}
