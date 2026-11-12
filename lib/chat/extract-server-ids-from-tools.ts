/**
 * Extracts unique non-internal MCP server IDs from a list of tool identifiers.
 *
 * @param tools - Array of tool identifiers in `<serverId>:tool:<toolName>` format
 * @returns Array of unique server IDs excluding "internal"
 * @author Maruf Bepary
 */
export function extractServerIdsFromTools(
  tools: readonly string[] | string[],
): string[] {
  return Array.from(
    new Set(
      tools
        .map((t) => t.split(":")[0])
        .filter((id): id is string => Boolean(id) && id !== "internal"),
    ),
  );
}
