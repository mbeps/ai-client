/**
 * Interface for column-level metadata in spreadsheets.
 * Enables customization of column presentation (headers, widths).
 *
 * @author Maruf Bepary
 */
export interface ColumnMetadata {
  /** The header label for the column. */
  header: string;
  /** Optional width of the column in pixels. */
  width?: number;
}
