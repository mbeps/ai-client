import { logger } from "@/lib/logger";
import { cloneAttachmentsBatch } from "@/lib/actions/attachments/clone-attachments-batch";
import type { Attachment } from "@/types/attachment/attachment";
import { toast } from "sonner";

/**
 * Clones existing attachment DB records for a new message.
 * Used during regeneration / branching where files already exist in S3.
 * Skips attachments that don't have a `key` (fresh uploads go through uploadAttachments).
 *
 * @param attachments - The list of attachments to clone.
 * @param newMessageId - The ID of the new message to associate with cloned attachments.
 * @returns The list of cloned attachments.
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
    toast.error(
      "Failed to clone attachments. They will not be sent to the AI.",
    );
    return [];
  }
}
