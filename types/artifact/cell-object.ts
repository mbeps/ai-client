import type { CellStyle } from "./cell-style";

/**
 * Enhanced cell object with optional styling information.
 * Allows fine-grained control over cell rendering in spreadsheets.
 *
 * @author Maruf Bepary
 */
export interface CellObject {
  /** The actual value of the cell. */
  v: string | number | boolean | null;
  /** Optional style properties for the cell. */
  s?: CellStyle;
}
