/**
 * File attachment type and size constraints for the chat application.
 * Defines allowed MIME types, maximum file sizes, and limits on attachment counts.
 * Use these constants in file upload validation to enforce consistent rules across client and server.
 *
 * @author Maruf Bepary
 */

/**
 * Allowed MIME types for image attachments: PNG, JPEG, GIF, and WebP.
 * Maximum 3 images per message; each must not exceed MAX_IMAGE_SIZE_BYTES.
 */
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/**
 * Allowed MIME types for document attachments: PDF, plain text, and Markdown.
 * Used for sharing text-based content; supports text extraction for AI analysis.
 */
export const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

/**
 * Allowed MIME types for spreadsheet attachments: XLSX, XLS, and CSV formats.
 * Processed via MCP Excel bridge for local staging and formula preservation.
 */
export const ALLOWED_SPREADSHEET_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv", // .csv
]);

/**
 * Maximum file size for images: 2 MB.
 * Enforced per-image with max 3 images per message.
 */
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Maximum file size for documents: 20 MB.
 * Applies to PDF, TXT, and Markdown files.
 */
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Maximum file size for spreadsheets: 50 MB.
 * Applies to XLSX, XLS, and CSV files for MCP bridge processing.
 */
export const MAX_SPREADSHEET_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Maximum number of images allowed per message: 3.
 * Additional images will be rejected during validation.
 */
export const MAX_IMAGES_PER_MESSAGE = 3;

/**
 * Maximum total attachments per message: 5.
 * Applies to combined count of images, documents, and spreadsheets.
 */
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
