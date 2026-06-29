/**
 * Configuration for an MCP server used in runtime initialization.
 * Lightweight representation containing only essential fields for connecting to a server.
 *
 * @author Maruf Bepary
 */
export type McpServerConfig = {
  /** Unique identifier for the server. */
  id: string;

  /** Display name of the server. */
  name: string;

  /** Connection URL for the HTTP server. */
  url: string;

  /** Optional custom headers (JSON string or null) for authentication. */
  headers?: string | null;
};
