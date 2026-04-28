import { type InferSelectModel } from "drizzle-orm";
import { mcpServer } from "../drizzle/schema";

/**
 * Database representation of an MCP (Model Context Protocol) server configuration from the drizzle schema.
 * type is 'stdio' or 'http'; stdio servers store command, args, and env; HTTP servers store url and headers.
 * enabled flag controls availability in tool selection UI.
 *
 * @see {@link ../drizzle/schemas/mcp-server-schema.ts} for database definition
 * @author Maruf Bepary
 */
export type McpServerRow = InferSelectModel<typeof mcpServer>;
