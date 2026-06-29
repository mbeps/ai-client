import { McpServer } from "./mcp-server";

/**
 * A helper that preserves union discrimination when omitting keys.
 * Used for safe type transformations without losing type narrowing.
 *
 * @author Maruf Bepary
 */
type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

/**
 * Represents a publicly shared MCP server.
 * This is a credential-stripped variant of the base McpServer type.
 * For HTTP servers, headers (which often contain API keys) are removed or sanitized.
 * Users can use these servers in their own chats, but cannot view/edit the underlying credentials.
 * Enables community sharing of tools without exposing sensitive authentication data.
 *
 * @see {@link types/mcp/mcp-server.ts} for the full McpServer type
 * @author Maruf Bepary
 */
export type PublicMcpServer = DistributiveOmit<McpServer, "headers"> & {
  /** The id of the user who owns/shares this server */
  userId: string;
  /** Always true for this variant */
  isPublic: true;
};
