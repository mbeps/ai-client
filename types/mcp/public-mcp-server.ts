import { McpServer } from "./mcp-server";
import { type DistributiveOmit } from "./distributive-omit";

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
