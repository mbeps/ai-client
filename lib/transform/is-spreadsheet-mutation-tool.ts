import { SPREADSHEET_MUTATION_TOOL_NAMES } from "@/lib/spreadsheet-mutation-tool-names";

/**
 * Returns `true` when the tool name is a spreadsheet mutation tool. Checks against the known set and also catches `write_*` prefixed tools.
 *
 * @param toolName - Target tool name
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function isSpreadsheetMutationTool(toolName: string): boolean {
  if (SPREADSHEET_MUTATION_TOOL_NAMES.has(toolName)) {
    return true;
  }

  return toolName.startsWith("write_");
}
