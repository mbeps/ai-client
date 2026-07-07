import { getPresignedUrl } from "@/lib/storage/get-presigned-url";
import { type ChatMessage } from "@/schemas/chat/chat";

/**
 * Extracts attachments from the latest user message and generates presigned URLs
 * for each attachment having a storage key.
 *
 * @param history The chat history
 * @returns A promise that resolves to an array of objects containing attachment name and presigned URL
 */
export async function getAttachmentUrls(history: ChatMessage[]) {
  const lastUserMessage = history.filter((m) => m.role === "user").pop();
  const messageAttachments =
    lastUserMessage?.attachments?.filter(
      (a: NonNullable<ChatMessage["attachments"]>[number]) => a.key,
    ) ?? [];

  return Promise.all(
    messageAttachments.map(
      async (a: NonNullable<ChatMessage["attachments"]>[number]) => {
        const url = await getPresignedUrl(a.key!);
        return { name: a.name, url };
      },
    ),
  );
}
