/**
 * Converts a structured spreadsheet artifact (from a manage_artifact tool call)
 * into an XLSX binary buffer ready for S3 upload.
 */

import * as XLSX from "xlsx";
import type { ArtifactData } from "@/types/artifact/artifact";

/**
 * Result of the conversion.
 */
export type XlsxConversionResult = {
  buffer: Buffer;
  mimeType: string;
};

/**
 * Converts a spreadsheet artifact into an XLSX buffer.
 *
 * The artifact's `content` is expected to be JSON with a `sheets` array,
 * each sheet having `name` and `data` (2D array) fields.
 *
 * @param artifact - The artifact object (type must be "spreadsheet").
 * @param workbook - An optional existing XLSX workbook to append sheets to.
 *                   Pass `null` to create a fresh workbook.
 * @returns The binary buffer and MIME type.
 * @throws If artifact content cannot be parsed or sheets are malformed.
 */
export async function artifactToXlsxBuffer(
  artifact: ArtifactData,
  workbook: XLSX.WorkBook | null,
): Promise<XlsxConversionResult> {
  const parsed = JSON.parse(artifact.content);
  const wb = workbook ?? XLSX.utils.book_new();

  const sheets = (parsed.sheets ?? []) as Array<{
    name?: string;
    data?: unknown[][];
  }>;

  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data ?? []);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name ?? "Sheet1");
  }

  const buffer = Buffer.from(
    XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer,
  );

  return {
    buffer,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
