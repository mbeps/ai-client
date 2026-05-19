/**
 * Data model for rendered artifacts (generated content from AI).
 * Supports Markdown, Spreadsheet (JSON), HTML, and Mermaid diagram types.
 */
export interface ArtifactData {
  /** Type of artifact: markdown, spreadsheet, html, or mermaid. */
  type: "markdown" | "spreadsheet" | "html" | "mermaid";

  /** Display title for the artifact. */
  title: string;

  /** Raw content string (Markdown, HTML, or stringified JSON for spreadsheet). */
  content: string;

  /** ID of the message that generated this artifact. */
  messageId?: string;
}

/**
 * Data model for structured multi-sheet spreadsheet artifacts.
 */
export interface ArtifactSpreadsheetData {
  /** Array of sheets in the workbook. */
  sheets: ArtifactSheet[];
  /** Optional suggested filename for download. */
  filename?: string;
}

/**
 * Interface representing a single sheet in an artifact spreadsheet.
 */
export interface ArtifactSheet {
  /** The unique name of the sheet. */
  name: string;
  /** 2D array of data. Elements can be primitives (string | number | boolean | null) or CellObject. */
  data: (string | number | boolean | null | CellObject)[][];
  /** Optional metadata for columns (e.g., width). */
  columns?: ColumnMetadata[];
}

/**
 * Interface for column-level metadata.
 */
export interface ColumnMetadata {
  /** The header label for the column. */
  header: string;
  /** Optional width of the column in pixels. */
  width?: number;
}

/**
 * Enhanced cell object with optional styling information.
 */
export interface CellObject {
  /** The actual value of the cell. */
  v: string | number | boolean | null;
  /** Optional style properties for the cell. */
  s?: CellStyle;
}

/**
 * Style properties for rendering spreadsheet cells.
 */
export interface CellStyle {
  /** Renders text in bold. */
  bold?: boolean;
  /** Renders text in italic. */
  italic?: boolean;
  /** Horizontal alignment of the cell content. */
  textAlign?: "left" | "center" | "right";
  /** Hex code or tailwind color name for the background. */
  backgroundColor?: string;
  /** Hex code or tailwind color name for the text color. */
  color?: string;
}
