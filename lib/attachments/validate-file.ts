import type { Attachment } from "@/types/attachment";
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_SPREADSHEET_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_SIZE_BYTES,
  MAX_SPREADSHEET_SIZE_BYTES,
} from "./constants";

/**
 * Result object indicating whether file validation passed or failed with reason.
 */
type ValidationResult = { valid: true } | { valid: false; reason: string };

/**
 * Validates a file before processing by checking type, size, and message-level quotas.
 * Images (PNG, JPG, GIF, WebP) are limited to 2 MB each with max 3 per message.
 * Documents (PDF, TXT, MD) are limited to 20 MB. Spreadsheets (XLSX, XLS, CSV) are limited to 50 MB.
 * Maximum 5 total attachments per message. Resolves MIME type from file.type or extension fallback (e.g., .md, .xlsx).
 * Returns detailed rejection reasons to display in UI.
 *
 * @param file - Browser File object to validate
 * @param existingAttachments - Already-attached files in current message for quota enforcement
 * @returns Validation result with valid=true on success or valid=false with detailed error reason
 * @see {@link constants.ts} for allowed types and size limits
 * @see {@link process-attachment.ts} for next processing step after validation passes
 */
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
    (file.name.toLowerCase().endsWith(".md") ? "text/markdown" : "") ||
    (file.name.toLowerCase().endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "") ||
    (file.name.toLowerCase().endsWith(".xls")
      ? "application/vnd.ms-excel"
      : "") ||
    (file.name.toLowerCase().endsWith(".csv") ? "text/csv" : "");
  const isImage = ALLOWED_IMAGE_TYPES.has(resolvedType);
  const isDocument = ALLOWED_DOCUMENT_TYPES.has(resolvedType);
  const isSpreadsheet = ALLOWED_SPREADSHEET_TYPES.has(resolvedType);

  if (!isImage && !isDocument && !isSpreadsheet) {
    return {
      valid: false,
      reason: `File type "${resolvedType || "unknown"}" is not supported. Allowed: PNG, JPG, GIF, WebP, PDF, TXT, MD, XLSX, XLS, CSV.`,
    };
  }

  if (isDocument && file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      valid: false,
      reason: `Document "${file.name}" exceeds the 20 MB limit.`,
    };
  }

  if (isSpreadsheet && file.size > MAX_SPREADSHEET_SIZE_BYTES) {
    return {
      valid: false,
      reason: `Spreadsheet "${file.name}" exceeds the 50 MB limit.`,
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
