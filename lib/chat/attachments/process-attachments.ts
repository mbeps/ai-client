import type { Attachment } from "@/types/attachment/attachment";
import { uploadSingleAttachment } from "./upload-single-attachment";
import { cloneAttachments } from "./clone-attachments";

/**
 * Processes attachments for a message, cloning existing ones and uploading new ones.
 * Existing attachments (with key) are cloned in batch; new ones are uploaded individually.
 *
 * @param attachments - Array of attachments to process.
 * @param messageId - The message ID to associate attachments with.
 * @returns Array of successfully processed attachments.
 */
export async function processAttachments(
  attachments: Attachment[],
  messageId: string,
): Promise<Attachment[]> {
  const result: Attachment[] = [];
  const toClone = attachments.filter((att) => att.key);
  const toUpload = attachments.filter((att) => !att.key);

  if (toClone.length > 0) {
    const cloned = await cloneAttachments(toClone, messageId);
    result.push(...cloned);
  }

  for (const att of toUpload) {
    const uploaded = await uploadSingleAttachment(att, messageId);
    if (uploaded) result.push(uploaded);
  }

  return result;
}
