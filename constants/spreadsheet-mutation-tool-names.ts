/**
 * Spreadsheet mutation tool names that modify workbooks in-place.
 * Used to track whether a step produced workbook changes for persistence.
 * Must be kept in sync with connected MCP server tool manifests.
 * ponytail: best-effort set; write_* prefix heuristic in isSpreadsheetMutationTool catches unlisted write tools
 * @author Maruf Bepary
 */
export const SPREADSHEET_MUTATION_TOOL_NAMES = new Set([
  "write_cells",
  "write_multi_sheet",
  "delete_rows",
  "insert_rows",
  "format_cells",
  "clear_range",
  "update_cell",
  "apply_formula",
  "merge_cells",
]);
