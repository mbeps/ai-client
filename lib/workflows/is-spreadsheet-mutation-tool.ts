import { SPREADSHEET_MUTATION_TOOL_NAMES } from "@/lib/spreadsheet-mutation-tool-names";

/**
 * Returns `true` when the tool name is a spreadsheet mutation tool.
 */
export function isSpreadsheetMutationTool(toolName: string): boolean {
  if (SPREADSHEET_MUTATION_TOOL_NAMES.has(toolName)) {
    return true;
  }
  return toolName.startsWith("write_");
}
