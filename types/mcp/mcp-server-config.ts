import type { McpAuthType } from "@/schemas/providers/mcp-server";

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

  /** Authentication type (none, headers, oauth). */
  authType?: McpAuthType;

  /** Optional custom headers (JSON string or null) for authentication. */
  headers?: string | null;

  /** User ID under whose context this server connection executes. */
  userId?: string;

  /** Optional OAuth client ID (pre-registered). */
  oauthClientId?: string | null;

  /** Optional OAuth client secret (pre-registered). */
  oauthClientSecret?: string | null;

  /** Optional OAuth scope. */
  oauthScope?: string | null;
};
