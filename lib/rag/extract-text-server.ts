import { extractDocumentContent } from "@/lib/utils/extraction-helpers";

// Larger limit for ingestion (not constrained by AI context window)
const MAX_CHARS = 500_000;

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  return extractDocumentContent(buffer, mimeType, MAX_CHARS);
}
