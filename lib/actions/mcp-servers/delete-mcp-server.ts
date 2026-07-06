"use server";

import { mcpServer } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

/**
 * Deletes one or more MCP server configurations for the authenticated user.
 *
 * @param idOrIds - UUID or array of UUIDs of the MCP servers to delete; must be owned by the authenticated user.
 * @returns { deletedCount: number } - The number of MCP servers successfully deleted.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database deletion fails due to constraints or connection issues.
 */
export const deleteMcpServer = deleteEntityFactory({
  table: mcpServer,
});
