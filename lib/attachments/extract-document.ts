import { MAX_DOCUMENT_CHARS } from "@/config/attachments";
import { extractDocumentContent } from "@/lib/utils/extraction-helpers";

/**
 * Extracts text content from a PDF file using the unified extraction helper.
 *
 * @param file - PDF file from browser File input
 * @returns Extracted text (up to 50k chars)
 */
export async function extractPdf(file: File): Promise<string> {
  return extractDocumentContent(file, "application/pdf", MAX_DOCUMENT_CHARS);
}

/**
 * Extracts raw text from plain text and markdown documents using the unified extraction helper.
 *
 * @param file - TXT or MD file from browser File input
 * @returns File contents as string (up to 50k chars)
 */
export async function extractPlainText(file: File): Promise<string> {
  return extractDocumentContent(
    file,
    file.type || "text/plain",
    MAX_DOCUMENT_CHARS,
  );
}
