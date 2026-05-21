import { McpServer } from "./mcp-server";

/**
 * A helper that preserves union discrimination when omitting keys.
 */
type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

/**
 * Represents a publicly shared MCP server.
 * This is a credential-stripped variant of the base McpServer type.
 * For HTTP servers, headers (which often contain API keys) are removed or sanitized.
 * For stdio servers, env (which often contains secrets) is removed or sanitized.
 *
 * Users can use these servers in their own chats, but cannot view/edit the
 * underlying credentials or environment variables.
 *
 * @author GitHub Copilot
 */
export type PublicMcpServer = DistributiveOmit<McpServer, "headers" | "env"> & {
  /** The id of the user who owns/shares this server */
  userId: string;
  /** Always true for this variant */
  isPublic: true;
};
