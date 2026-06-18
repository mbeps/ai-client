"use server";

import { mcpServer } from "@/drizzle/schema";
import {
  createMcpServerSchema,
  type CreateMcpServer,
} from "@/schemas/providers/mcp-server";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";
import { buildServerConfig } from "@/lib/mcp/build-server-config";
import { createEntityFactory } from "@/lib/actions/shared/create-entity-factory";

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
export const createMcpServer = createEntityFactory<
  CreateMcpServer,
  McpServerRow
>({
  table: mcpServer,
  schema: createMcpServerSchema,
  mapValues: (validated, userId) => ({
    ...buildServerConfig(validated),
    userId,
  }),
});
