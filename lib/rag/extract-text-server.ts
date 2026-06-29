import { extractDocumentContent } from "@/lib/utils/extraction-helpers";

// Larger limit for ingestion (not constrained by AI context window)
const MAX_CHARS = 500_000;

/**
 * Extracts text from documents (PDF, text, Markdown) up to 500K characters for KB ingestion.
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
  return extractDocumentContent(buffer, mimeType, MAX_CHARS);
}
