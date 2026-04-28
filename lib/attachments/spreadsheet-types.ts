/**
 * MIME types that identify spreadsheet files.
 * Used for server-side validation of file uploads and type detection.
 * Supports: Excel (.xlsx, .xlsm, .xls) and CSV formats.
 */
export const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "text/csv",
]);

/**
 * File extensions that identify spreadsheet files.
 * Used for client-side validation and file type checking.
 * Supports: Excel (.xlsx, .xlsm, .xls) and CSV formats.
 */
export const SPREADSHEET_EXTENSIONS = new Set([
  ".xlsx",
  ".xlsm",
  ".xls",
  ".csv",
]);

const MIME_BY_EXT: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
};

/**
 * Extracts lowercase file extension from a filename.
 * Returns empty string if filename has no extension.
 * Example: "data.xlsx" → ".xlsx", "README" → ""
 *
 * @param name - Filename to extract extension from
 * @returns Lowercase extension with dot prefix, or empty string
 */
export function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

/**
 * Validates whether a file is a spreadsheet by checking extension and MIME type.
 * Returns true if either the extension or MIME type matches known spreadsheet formats.
 * Use this before processing file uploads as spreadsheets.
 *
 * @param name - Filename to validate
 * @param mimeType - MIME type from file upload (e.g., from File object)
 * @returns True if file is identified as a spreadsheet, false otherwise
 */
export function isSpreadsheet(name: string, mimeType: string): boolean {
  return (
    SPREADSHEET_EXTENSIONS.has(getExtension(name)) ||
    SPREADSHEET_MIME_TYPES.has(mimeType)
  );
}

/**
 * Returns the correct MIME type for a spreadsheet file based on its extension.
 * Falls back to "application/octet-stream" if extension is not recognised.
 * Used to set correct Content-Type header when uploading files to S3.
 *
 * @param name - Filename to determine MIME type for
 * @returns MIME type string matching the file extension
 */
export function spreadsheetMimeFromName(name: string): string {
  return MIME_BY_EXT[getExtension(name)] ?? "application/octet-stream";
}
