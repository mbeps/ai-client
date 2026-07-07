import type { Attachment } from "@/types/attachment/attachment";
import { uploadSingleAttachment } from "./upload-single-attachment";

/**
 * Sequentially uploads all attachments for a message.
 * Failed uploads are skipped with a toast notification; remaining uploads continue.
 *
 * @param attachments - Array of attachments to upload.
 * @param messageId - The message ID to associate uploads with.
 * @returns Array of successfully uploaded attachments (with S3 keys populated).
 */
export async function uploadAttachments(
  attachments: Attachment[],
  messageId: string,
): Promise<Attachment[]> {
  const uploaded: Attachment[] = [];

  for (const att of attachments) {
    const result = await uploadSingleAttachment(att, messageId);
    if (result) {
      uploaded.push(result);
    }
  }

  return uploaded;
}
