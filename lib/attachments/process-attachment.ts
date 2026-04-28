import { validateFile } from "./validate-file";
import { extractPdf, extractPlainText } from "./extract-document";
import type { Attachment } from "@/types/attachment";
import { ALLOWED_IMAGE_TYPES, ALLOWED_SPREADSHEET_TYPES } from "./constants";

/**
 * Converts a browser File to a structured Attachment object.
 * Validates the file first, then routes to type-specific processing:
 * images are converted to base64 data URLs, spreadsheets are preserved for MCP bridge,
 * and documents (PDF, TXT, MD) are text-extracted with 50k character limit.
 * Generates random UUID for client-side tracking before S3 upload.
 *
 * @param file - Browser File object from input element
 * @param existingAttachments - Already-processed attachments in message for validation quota checks
 * @returns Structured Attachment with type-specific payload (dataUrl for images, extractedText for documents, etc.)
 * @throws {Error} When validation fails (type, size, quota), PDF extraction fails, or file reading fails
 * @see {@link validate-file.ts} for validation rules
 * @see {@link extract-document.ts} for PDF and text extraction
 * @see {@link constants.ts} for size and type constraints
 */
export async function processAttachment(
  file: File,
  existingAttachments: Attachment[],
): Promise<Attachment> {
  /**
   * Reads a file as base64 data URL using FileReader API.
   * Used for images that will be embedded in JSON before S3 upload.
   *
   * @param file - Image file to read
   * @returns Base64-encoded data URL (e.g., data:image/png;base64,...)
   * @throws {Error} When FileReader encounters read error
   */
  function readAsDataUrl(file: File): Promise<string> {
  const validation = validateFile(file, existingAttachments);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const id = crypto.randomUUID();
  const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
  const isSpreadsheet =
    ALLOWED_SPREADSHEET_TYPES.has(file.type) ||
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.name.toLowerCase().endsWith(".xls") ||
    file.name.toLowerCase().endsWith(".csv");

  if (isImage) {
    const dataUrl = await readAsDataUrl(file);
    return {
      id,
      type: "image",
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      dataUrl,
    };
  }

  if (isSpreadsheet) {
    return {
      id,
      type: "spreadsheet",
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      dataUrl: "",
      rawFile: file,
    };
  }

  const extractedText =
    file.type === "application/pdf"
      ? await extractPdf(file)
      : await extractPlainText(file);

  return {
    id,
    type: "document",
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    dataUrl: "",
    extractedText,
  };
}
