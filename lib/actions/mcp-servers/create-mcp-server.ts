"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import {
  createMcpServerSchema,
  type CreateMcpServer,
} from "@/schemas/providers/mcp-server";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";
import { buildServerConfig } from "@/lib/mcp/build-server-config";

/**
 * Creates a new MCP server configuration for the authenticated user.
 * Supports HTTP (URL-based) server types.
 * Validates all configuration fields.
 *
 * @param data - Server configuration object validated against createMcpServerSchema (name, url required).
 * @returns The newly created MCP server row with all fields populated.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws ZodError if data fails schema validation (missing required fields, malformed URL).
 * @throws Error if database insertion fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
export async function createMcpServer(
  data: CreateMcpServer,
): Promise<McpServerRow> {
  const session = await requireSession();

  const parsed = createMcpServerSchema.parse(data);

  const values = buildServerConfig(parsed);

  const [created] = await db
    .insert(mcpServer)
    .values({
      ...values,
      userId: session.user.id,
    })
    .returning();

  return created;
}
