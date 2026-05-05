import { getExtension, MIME_BY_EXT } from "@/lib/attachments/spreadsheet-types";

/**
 * Resolves the effective MIME type for a file by checking file.type first,
 * then falling back to extension-based detection for common formats
 * that browsers may not recognise natively (.md, .xlsx, .xls, .csv).
 *
 * @param file - Browser File object to inspect.
 * @returns MIME type string, or empty string if unrecognised.
 */
export function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".md")) return "text/markdown";
  return MIME_BY_EXT[getExtension(file.name)] ?? "";
}
