import type { CellObject } from "./cell-object";
import type { ColumnMetadata } from "./column-metadata";

/**
 * Interface representing a single sheet in an artifact spreadsheet.
 * Contains the 2D data array and optional column metadata.
 *
 * @author Maruf Bepary
 */
export interface ArtifactSheet {
  /** The unique name of the sheet. */
  name: string;
  /** 2D array of data. Elements can be primitives (string | number | boolean |
null) or CellObject. */
  data: (string | number | boolean | null | CellObject)[][];
  /** Optional metadata for columns (e.g., width). */
  columns?: ColumnMetadata[];
}
