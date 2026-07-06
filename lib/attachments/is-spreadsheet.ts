import {
  ALLOWED_SPREADSHEET_TYPES,
  SPREADSHEET_EXTENSIONS,
} from "@/constants/attachments";
import { getExtension } from "./get-extension";

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
    ALLOWED_SPREADSHEET_TYPES.has(mimeType)
  );
}
