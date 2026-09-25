/**
 * Default timeout for MCP operations in milliseconds.
 * Used for connection, tool discovery, and prompt retrieval.
 */
const MCP_TIMEOUT_MS = 10_000;

/**
 * List of all MCP configurations.
 */
export const MCP_SETTINGS = {
  MCP_TIMEOUT_MS,
} as const;
