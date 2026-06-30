/**
 * Style properties for rendering spreadsheet cells.
 * Controls appearance and formatting of cell content.
 *
 * @author Maruf Bepary
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
