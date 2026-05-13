"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import {
  createMcpServerSchema,
  type CreateMcpServer,
} from "@/schemas/mcp-server";
import type { McpServerRow } from "@/types/mcp-server-row";
import { buildServerConfig } from "@/lib/mcp/build-server-config";

/**
 * Creates a new MCP server configuration for the authenticated user.
 * Supports both stdio (command-based) and HTTP (URL-based) server types.
 * Validates all configuration fields based on server type.
 *
 * @param data - Server configuration object validated against createMcpServerSchema (name, type required; command/url and other fields conditional on type).
 * @returns The newly created MCP server row with all fields populated.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws ZodError if data fails schema validation (missing required fields, invalid type, malformed URL/command).
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
