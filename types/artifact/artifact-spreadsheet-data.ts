import type { ArtifactSheet } from "./artifact-sheet";

/**
 * Data model for structured multi-sheet spreadsheet artifacts.
 * Represents a complete workbook that can be exported or displayed.
 *
 * @author Maruf Bepary
 */
export interface ArtifactSpreadsheetData {
  /** Array of sheets in the workbook. */
  sheets: ArtifactSheet[];
  /** Optional suggested filename for download. */
  filename?: string;
}
