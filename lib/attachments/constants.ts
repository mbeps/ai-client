export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

export const ALLOWED_SPREADSHEET_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv", // .csv
]);

export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_SPREADSHEET_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_IMAGES_PER_MESSAGE = 3;
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
