import { MIME_BY_EXT } from "@/constants/attachments";
import { getExtension } from "./get-extension";

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
