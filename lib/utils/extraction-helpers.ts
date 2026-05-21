import { extractText, getDocumentProxy } from "unpdf";

/**
 * Unifies PDF and text extraction logic.
 * Merges unpdf usage and handles plain text/JSON/XML extraction.
 *
 * @param input - Buffer, Uint8Array or File to extract text from
 * @param mimeType - MIME type of the document
 * @param limit - Maximum characters to extract (default: 50,000)
 * @returns Extracted text string
 */
export async function extractDocumentContent(
  input: Buffer | Uint8Array | File,
  mimeType: string,
  limit: number = 50000,
): Promise<string> {
  let buffer: Uint8Array;

  if (input instanceof File) {
    buffer = new Uint8Array(await input.arrayBuffer());
  } else {
    buffer = new Uint8Array(input);
  }

  if (mimeType === "application/pdf") {
    try {
      const pdf = await getDocumentProxy(buffer);
      const { text } = await extractText(pdf, { mergePages: true });
      return text.slice(0, limit);
    } catch (error) {
      console.error("Error extracting PDF content:", error);
      throw new Error("Failed to extract text from PDF");
    }
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  ) {
    const text = new TextDecoder().decode(buffer);
    return text.slice(0, limit);
  }

  // Fallback for unknown types if it's text-like but doesn't start with text/
  try {
    const text = new TextDecoder().decode(buffer);
    return text.slice(0, limit);
  } catch (error) {
    throw new Error(`Unsupported or unreadable MIME type: ${mimeType}`);
  }
}
