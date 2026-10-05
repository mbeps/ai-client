/**
 * Default timeout for MCP operations in milliseconds.
 * Used for connection, tool discovery, and prompt retrieval.
 */
const MCP_TIMEOUT_MS = 10_000;

/**
 * Maximum execution timeout for MCP tool calls in milliseconds (2 minutes).
 * Bounds remote execution to prevent hanging streams or uncooperative transports.
 */
const MCP_TOOL_CALL_TIMEOUT_MS = 120_000;

/**
 * List of all MCP configurations.
 */
export const MCP_SETTINGS = {
  MCP_TIMEOUT_MS,
  MCP_TOOL_CALL_TIMEOUT_MS,
} as const;
