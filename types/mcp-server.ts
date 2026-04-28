/**
 * Represents a Model Context Protocol (MCP) server providing tools to the AI pipeline.
 * MCP servers enable the AI to call external functions: local executables (stdio)
 * or remote HTTP APIs. Tools from enabled servers are discoverable and selectable
 * per-message via the tool picker dialog.
 *
 * @author Maruf Bepary
 */
export type McpServer = {
  /** Unique identifier for this MCP server (UUID). */
  id: string;

  /** Human-readable server name (e.g., "File Browser", "Weather API"). */
  name: string;

  /**
   * Transport type: "stdio" for local process execution, "http" for remote API calls.
   * Determines how the server is invoked and how results are returned.
   */
  type: "stdio" | "http";

  /**
   * Command to execute for stdio servers (e.g., "python", "node").
   * Required for stdio type; null for http servers.
   */
  command: string | null;

  /**
   * Arguments passed to the command for stdio servers (e.g., "script.py --debug").
   * Stored as a single string and split during execution. Null for http servers.
   */
  args: string | null;

  /**
   * HTTP endpoint URL for http-type servers.
   * Must include protocol (http:// or https://). Null for stdio servers.
   */
  url: string | null;

  /**
   * HTTP headers as a JSON string (e.g., '{"Authorization": "Bearer token"}').
   * Applied to all requests made to the http server. Null if not required.
   */
  headers: string | null;

  /**
   * Environment variables as a JSON string (e.g., '{"LOG_LEVEL": "debug"}').
   * Applied to the stdio process environment. Null if not required.
   */
  env: string | null;

  /** Whether this server is active and available for tool discovery and invocation. */
  enabled: boolean;

  /** Timestamp of server creation. */
  createdAt: Date;

  /** Timestamp of the last modification to this server's configuration. */
  updatedAt: Date;
};
