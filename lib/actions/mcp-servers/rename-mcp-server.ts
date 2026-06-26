"use server";

import { mcpServer } from "@/drizzle/schema";
import { renameEntityFactory } from "@/lib/actions/shared/rename-entity-factory";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";

/**
 * Renames an MCP server configuration for the authenticated user.
 *
 * @param id - UUID of the MCP server to rename; must be owned by the authenticated user.
 * @param name - The new name for the MCP server.
 * @returns The updated MCP server row with new name.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 */
export const renameMcpServer = renameEntityFactory<McpServerRow>({
  table: mcpServer,
  validateId: false,
});
