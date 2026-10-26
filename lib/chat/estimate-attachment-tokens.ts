import { estimateTokens } from "@/lib/chat/estimate-tokens";
import type { Attachment } from "@/types/attachment/attachment";

/**
 * Estimates token count for an attachment.
 * Text files use string length estimation; images/binary use fixed vision tile estimates (~800 tokens).
 *
 * @param attachment - The attachment to estimate
 * @returns Estimated token count
 */
export function estimateAttachmentTokens(attachment: Attachment): number {
  if (attachment.type === "image") {
    return 800;
  }
  if (attachment.extractedText) {
    return estimateTokens(attachment.extractedText);
  }
  if (attachment.sizeBytes) {
    // Approx 1 token per 4 bytes of raw text
    return Math.ceil(attachment.sizeBytes / 4);
  }
  return 100;
}
