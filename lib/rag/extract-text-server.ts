import { extractText, getDocumentProxy } from "unpdf";

// Larger limit for ingestion (not constrained by AI context window)
const MAX_CHARS = 500_000;

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.slice(0, MAX_CHARS);
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  ) {
    return buffer.toString("utf-8").slice(0, MAX_CHARS);
  }

  throw new Error(`Unsupported MIME type for KB ingestion: ${mimeType}`);
}
