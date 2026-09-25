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
  "delete_row",
  "delete_rows",
  "insert_row",
  "insert_rows",
  "delete_column",
  "delete_columns",
  "insert_column",
  "insert_columns",
  "format_cells",
  "clear_range",
  "update_cell",
  "update_cells",
  "set_cell",
  "set_cells",
  "set_cell_value",
  "append_row",
  "append_rows",
  "apply_formula",
  "merge_cells",
  "unmerge_cells",
  "create_sheet",
  "add_sheet",
  "delete_sheet",
  "rename_sheet",
  "copy_sheet",
  "sort_range",
  "sort_rows",
  "sort_sheet",
]);
