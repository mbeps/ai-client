/**
 * Spreadsheet mutation tool names that modify workbooks in-place.
 * Used to track whether a step produced workbook changes for persistence.
 * @author Maruf Bepary
 */
export const SPREADSHEET_MUTATION_TOOL_NAMES = new Set([
  "write_cells",
  "write_multi_sheet",
]);
