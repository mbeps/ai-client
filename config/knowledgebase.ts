/**
 * Knowledge base document upload constraints and accepted formats.
 */
export const KB_CONFIG = {
  ACCEPTED_EXTENSIONS: ".pdf,.txt,.md,.png,.jpg,.jpeg,.webp",
  ALLOWED_MIME_TYPES: new Set([
    "application/pdf",
    "text/plain",
    "text/markdown",
    "image/png",
    "image/jpeg",
    "image/webp",
  ]),
  MAX_FILE_SIZE_MB: 50,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
} as const;

export const KB_IMAGE_CONFIG = {
  MIN_IMAGE_DIMENSION: 100,
  MAX_IMAGE_DIMENSION: 2048,
  MAX_IMAGES_PER_DOC: 50,
} as const;
