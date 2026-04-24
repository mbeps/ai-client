import { validateFile } from "./validate-file";
import { extractPdf, extractPlainText } from "./extract-document";
import type { Attachment } from "@/types/attachment";
import { ALLOWED_IMAGE_TYPES, ALLOWED_SPREADSHEET_TYPES } from "./constants";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed to read file."));
    reader.readAsDataURL(file);
  });
}

export async function processAttachment(
  file: File,
  existingAttachments: Attachment[],
): Promise<Attachment> {
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
