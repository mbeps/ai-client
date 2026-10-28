import { cloneAttachments } from "@/lib/chat/attachments/clone-attachments";
import { uploadSingleAttachment } from "@/lib/chat/attachments/upload-single-attachment";
import type { Attachment } from "@/types/attachment/attachment";

/**
 * Processes attachments for a message, cloning existing ones and uploading new ones.
 * Existing attachments (with key) are cloned in batch; new ones are uploaded concurrently via Promise.all.
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

  if (toUpload.length > 0) {
    const uploadedList = await Promise.all(
      toUpload.map((att) => uploadSingleAttachment(att, messageId)),
    );
    for (const uploaded of uploadedList) {
      if (uploaded) result.push(uploaded);
    }
  }

  return result;
}
