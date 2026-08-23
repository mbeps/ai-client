import { extractDocumentContent } from "@/lib/utils/extraction-helpers";
import { env } from "@/lib/env";

/** Character limit for KB ingestion extraction (not constrained by AI context window). */
export const MAX_DOCUMENT_CHARS_LIMIT = env.MAX_DOCUMENT_CHARS;

/**
 * Extracts text from documents (PDF, text, Markdown) up to MAX_DOCUMENT_CHARS for KB ingestion.
 *
 * @async
 * @param buffer - File content
 * @param mimeType - MIME type (application/pdf, text/plain, text/markdown)
 * @returns Extracted plaintext; empty string if unsupported or unreadable
 * @throws Error if extraction fails
 * @author Maruf Bepary
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  return extractDocumentContent(buffer, mimeType, MAX_DOCUMENT_CHARS_LIMIT);
}
