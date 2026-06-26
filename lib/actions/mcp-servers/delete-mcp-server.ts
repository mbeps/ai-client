"use server";

import { mcpServer } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

/**
 * Deletes an MCP server configuration for the authenticated user.
 *
 * @param id - UUID of the MCP server to delete; must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database deletion fails due to constraints or connection issues.
 */
export const deleteMcpServer = deleteEntityFactory({
  table: mcpServer,
});
