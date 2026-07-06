import { logger } from "@/lib/logger";
import { uploadAttachment } from "@/lib/actions/attachments/upload-attachment";
import { cloneAttachmentsBatch } from "@/lib/actions/attachments/clone-attachments-batch";
import type { Attachment } from "@/types/attachment/attachment";
import { toast } from "sonner";

/**
 * Uploads a single attachment by building the FormData and calling the server action.
 *
 * @param attachment - The attachment to upload (must have rawFile or dataUrl).
 * @param messageId - The message ID to associate the upload with.
 * @returns The uploaded attachment with its S3 key populated, or null on failure.
 */
export async function uploadSingleAttachment(
  attachment: Attachment,
  messageId: string,
): Promise<Attachment | null> {
  try {
    const formData = new FormData();
    let blob: Blob;
    if (attachment.rawFile) {
      blob = attachment.rawFile;
    } else {
      const response = await fetch(attachment.dataUrl);
      blob = await response.blob();
    }
    const file = new File([blob], attachment.name, {
      type: attachment.mimeType,
    });
    formData.append("file", file);
    formData.append("messageId", messageId);
    formData.append("attachmentId", attachment.id);
    if (attachment.extractedText) {
      formData.append("extractedText", attachment.extractedText);
    }

    const data = await uploadAttachment(formData);
    return { ...attachment, key: data.key };
  } catch (err) {
    logger.error("[Chat] Attachment upload failed:", err);
    toast.error(
      `Failed to upload "${attachment.name}". It will not be sent to the AI.`,
    );
    return null;
  }
}

/**
 * Clones existing attachment DB records for a new message.
 * Used during regeneration / branching where files already exist in S3.
 * Skips attachments that don't have a `key` (fresh uploads go through uploadAttachments).
 */
export async function cloneAttachments(
  attachments: Attachment[],
  newMessageId: string,
): Promise<Attachment[]> {
  const attachmentsToClone = attachments.filter((att) => att.key);
  if (attachmentsToClone.length === 0) return [];

  try {
    const ids = attachmentsToClone.map((att) => att.id);
    const results = await cloneAttachmentsBatch(ids, newMessageId);

    return results.map((result) => {
      const original = attachmentsToClone.find((a) => a.key === result.key);
      return {
        ...original!,
        id: result.id,
        key: result.key,
        extractedText: result.extractedText ?? original?.extractedText,
      } as Attachment;
    });
  } catch (err) {
    logger.error("[Chat] Attachment batch clone failed:", err);
    toast.error("Failed to clone attachments. They will not be sent to the AI.");
    return [];
  }
}

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
