import { uploadAttachment } from "@/lib/actions/attachments/upload-attachment";
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
