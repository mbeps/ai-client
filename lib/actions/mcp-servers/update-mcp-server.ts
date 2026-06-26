"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import {
  updateMcpServerSchema,
  type UpdateMcpServer,
} from "@/schemas/providers/mcp-server";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";
import { buildServerConfig } from "@/lib/mcp/build-server-config";

/**
 * Updates an existing MCP server configuration for the authenticated user.
 * Validates all configuration fields.
 *
 * @param id - UUID of the MCP server to update; must be owned by the authenticated user.
 * @param data - Updated server configuration validated against updateMcpServerSchema.
 * @returns The updated MCP server row with all fields.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws ZodError if data fails schema validation (malformed URL, etc.).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 */
export async function updateMcpServer(
  id: string,
  data: UpdateMcpServer,
): Promise<McpServerRow> {
  const session = await requireSession();

  const parsed = updateMcpServerSchema.parse(data);

  const values = buildServerConfig(parsed);

  const [updated] = await db
    .update(mcpServer)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (!updated) throw new Error("Not Found");

  return updated;
}
