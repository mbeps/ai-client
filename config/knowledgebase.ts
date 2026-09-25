/**
 * Knowledge base document upload constraints and accepted formats.
 */
export const KB_CONFIG = {
  ACCEPTED_EXTENSIONS: ".pdf,.txt,.md",
  ALLOWED_MIME_TYPES: new Set([
    "application/pdf",
    "text/plain",
    "text/markdown",
  ]),
  MAX_FILE_SIZE_MB: 50,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
} as const;
