import { logger } from "@/lib/logger";
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
    if (attachment.extractedText) {
      formData.append("extractedText", attachment.extractedText);
    }

    const data = await uploadAttachment(formData);
    // Strip client-side blobs once the S3 key exists — the UI preview only
    // needs dataUrl pre-upload, and rawFile/dataUrl must not leak into
    // persisted messages or store state.
    const { rawFile: _rawFile, ...rest } = attachment;
    // ponytail: dataUrl is required on Attachment (shared type), so an empty
    // string is used as the "stripped" sentinel instead of omitting the field.
    return { ...rest, dataUrl: "", key: data.key };
  } catch (err) {
    logger.error("[Chat] Attachment upload failed:", err);
    toast.error(
      `Failed to upload "${attachment.name}". It will not be sent to the AI.`,
    );
    return null;
  }
}
