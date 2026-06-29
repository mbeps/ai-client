import { type InferSelectModel } from "drizzle-orm";
import { mcpServer } from "@/drizzle/schema";

/**
 * Database representation of an MCP (Model Context Protocol) server configuration.
 * From the Drizzle schema; HTTP servers store URL and optional headers (authentication).
 * enabled flag controls visibility and availability in tool selection UI.
 * isPublic flag indicates whether server is shared with other users.
 *
 * @see {@link types/mcp/mcp-server.ts} for enriched McpServer type
 * @see {@link types/mcp/public-mcp-server.ts} for public server variant
 * @author Maruf Bepary
 */
export type McpServerRow = InferSelectModel<typeof mcpServer>;
