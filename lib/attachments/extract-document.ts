import { extractText, getDocumentProxy } from "unpdf";

/**
 * Maximum characters to extract from documents before truncation.
 * Prevents extremely large documents from bloating AI context.
 */
const MAX_DOCUMENT_CHARS = 50_000;

/**
 * Extracts text content from a PDF file using the unpdf library.
 * Merges all pages into a single text block and limits output to 50k characters.
 * Handles binary PDF data conversion from File.arrayBuffer() to Uint8Array for the PDF processor.
 *
 * @param file - PDF file from browser File input
 * @returns Extracted text (up to 50k chars), or empty string if extraction fails
 * @throws {Error} When PDF parsing fails or arrayBuffer() conversion fails
 * @see {@link extract-document.ts} for extractPlainText alternative
 */
export async function extractPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
  const { text } = await extractText(pdf, { mergePages: true });

  return text.slice(0, MAX_DOCUMENT_CHARS);
}

/**
 * Extracts raw text from plain text and markdown documents.
 * Limits output to 50k characters to match PDF extraction behavior.
 * Uses File.text() API for direct string conversion.
 *
 * @param file - TXT or MD file from browser File input
 * @returns File contents as string (up to 50k chars)
 * @throws {Error} When file.text() fails or encoding is invalid
 * @see {@link extractPdf} for PDF text extraction
 */
export async function extractPlainText(file: File): Promise<string> {
  const text = await file.text();
  return text.slice(0, MAX_DOCUMENT_CHARS);
}
