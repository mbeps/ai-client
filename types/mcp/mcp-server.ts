import { z } from "zod";
import { mcpServerSchema } from "@/schemas/providers/mcp-server";

/**
 * Represents an MCP (Model Context Protocol) server configuration.
 * HTTP servers enable tool invocation and resource discovery via standardized interfaces.
 * Derived from Zod schema for validation and type safety.
 * Users can configure multiple MCP servers and bind them to chats, projects, or assistants.
 *
 * @see {@link schemas/providers/mcp-server.ts} for validation schemas
 * @see {@link types/mcp/mcp-server-row.ts} for database representation
 * @see {@link types/mcp/public-mcp-server.ts} for publicly shared servers
 * @author Maruf Bepary
 */
export type McpServer = z.infer<typeof mcpServerSchema>;
