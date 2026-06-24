import { uploadAttachment } from "@/lib/actions/attachments/upload-attachment";
import { cloneAttachment } from "@/lib/actions/attachments/clone-attachment";
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
    console.error("[Chat] Attachment upload failed:", err);
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
  const cloned: Attachment[] = [];

  for (const att of attachments) {
    if (!att.key) continue;

    try {
      const result = await cloneAttachment(att.id, newMessageId);
      cloned.push({
        ...att,
        id: result.id,
        key: result.key,
        extractedText: result.extractedText ?? att.extractedText,
      });
    } catch (err) {
      console.error("[Chat] Attachment clone failed:", err);
      toast.error(
        `Failed to clone "${att.name}". It will not be sent to the AI.`,
      );
    }
  }

  return cloned;
}

/**
 * Processes attachments for a message, cloning existing ones and uploading new ones.
 * Each attachment is handled individually: if it has an S3 `key` it's cloned,
 * otherwise it's uploaded fresh.
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

  for (const att of attachments) {
    if (att.key) {
      // Already in S3 → clone DB record
      try {
        const cloned = await cloneAttachment(att.id, messageId);
        result.push({
          ...att,
          id: cloned.id,
          key: cloned.key,
          extractedText: cloned.extractedText ?? att.extractedText,
        });
      } catch (err) {
        console.error("[Chat] Attachment clone failed:", err);
        toast.error(
          `Failed to clone "${att.name}". It will not be sent to the AI.`,
        );
      }
    } else {
      // New file → upload to S3 + insert DB record
      const uploaded = await uploadSingleAttachment(att, messageId);
      if (uploaded) result.push(uploaded);
    }
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
