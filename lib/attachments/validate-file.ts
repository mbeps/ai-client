import type { Attachment } from "@/lib/store";
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_SIZE_BYTES,
} from "./constants";

type ValidationResult = { valid: true } | { valid: false; reason: string };

export function validateFile(
  file: File,
  existingAttachments: Attachment[],
): ValidationResult {
  if (existingAttachments.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
    return {
      valid: false,
      reason: `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message.`,
    };
  }

  const resolvedType =
    file.type ||
    (file.name.toLowerCase().endsWith(".md") ? "text/markdown" : "");
  const isImage = ALLOWED_IMAGE_TYPES.has(resolvedType);
  const isDocument = ALLOWED_DOCUMENT_TYPES.has(resolvedType);

  if (!isImage && !isDocument) {
    return {
      valid: false,
      reason: `File type "${resolvedType || "unknown"}" is not supported. Allowed: PNG, JPG, GIF, WebP, PDF, TXT, MD.`,
    };
  }

  if (isDocument && file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      valid: false,
      reason: `Document "${file.name}" exceeds the 20 MB limit.`,
    };
  }

  if (isImage) {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return {
        valid: false,
        reason: `Image "${file.name}" exceeds the 2 MB limit.`,
      };
    }
    const imageCount = existingAttachments.filter(
      (a) => a.type === "image",
    ).length;
    if (imageCount >= MAX_IMAGES_PER_MESSAGE) {
      return {
        valid: false,
        reason: `Maximum ${MAX_IMAGES_PER_MESSAGE} images per message.`,
      };
    }
  }

  return { valid: true };
}
