"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { eq, and, desc, not } from "drizzle-orm";
import {
  createMcpServerSchema,
  updateMcpServerSchema,
  type CreateMcpServer,
  type UpdateMcpServer,
} from "@/schemas/mcp-server";
import type { McpServerRow } from "@/types/mcp-server-row";

/**
 * Lists all MCP servers configured by the authenticated user.
 * Returns servers ordered by most recently updated first.
 *
 * @returns Array of MCP server configurations (name, type, connection details, enabled status).
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if database query fails due to connection issues.
 * @author Maruf Bepary
 */
export async function listMcpServers(): Promise<McpServerRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(mcpServer)
    .where(eq(mcpServer.userId, session.user.id))
    .orderBy(desc(mcpServer.updatedAt));
}

/**
 * Retrieves a single MCP server configuration by ID.
 *
 * @param id - UUID of the MCP server to retrieve; must be owned by the authenticated user.
 * @returns The MCP server row with all connection details and configuration.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database query fails due to connection issues.
 * @author Maruf Bepary
 */
export async function getMcpServer(id: string): Promise<McpServerRow> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(mcpServer)
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)));

  if (!row) throw new Error("Not Found");

  return row;
}

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

  const values =
    parsed.type === "stdio"
      ? {
          name: parsed.name,
          type: parsed.type,
          command: parsed.command,
          args: parsed.args ?? null,
          env: parsed.env ?? null,
          url: null,
          headers: null,
        }
      : {
          name: parsed.name,
          type: parsed.type,
          url: parsed.url,
          headers: parsed.headers ?? null,
          command: null,
          args: null,
          env: null,
        };

  const [created] = await db
    .insert(mcpServer)
    .values({
      ...values,
      userId: session.user.id,
    })
    .returning();

  return created;
}

/**
 * Updates an existing MCP server configuration for the authenticated user.
 * Validates all configuration fields based on server type (stdio or HTTP).
 *
 * @param id - UUID of the MCP server to update; must be owned by the authenticated user.
 * @param data - Updated server configuration validated against updateMcpServerSchema.
 * @returns The updated MCP server row with all fields.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws ZodError if data fails schema validation (invalid type, malformed URL/command, etc.).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
export async function updateMcpServer(
  id: string,
  data: UpdateMcpServer,
): Promise<McpServerRow> {
  const session = await requireSession();

  const parsed = updateMcpServerSchema.parse(data);

  const values =
    parsed.type === "stdio"
      ? {
          name: parsed.name,
          type: parsed.type,
          command: parsed.command,
          args: parsed.args ?? null,
          env: parsed.env ?? null,
          url: null,
          headers: null,
        }
      : {
          name: parsed.name,
          type: parsed.type,
          url: parsed.url,
          headers: parsed.headers ?? null,
          command: null,
          args: null,
          env: null,
        };

  const [updated] = await db
    .update(mcpServer)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (!updated) throw new Error("Not Found");

  return updated;
}

/**
 * Deletes an MCP server configuration for the authenticated user.
 *
 * @param id - UUID of the MCP server to delete; must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database deletion fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
export async function deleteMcpServer(id: string): Promise<void> {
/**
 * Toggles the enabled/disabled status of an MCP server for the authenticated user.
 * Used to quickly enable/disable tool availability without deleting the configuration.
 *
 * @param id - UUID of the MCP server to toggle; must be owned by the authenticated user.
 * @returns The updated MCP server row with new enabled status.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
  const session = await requireSession();

  const [deleted] = await db
    .delete(mcpServer)
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning({ id: mcpServer.id });

  if (!deleted) throw new Error("Not Found");
}

export async function toggleMcpServer(id: string): Promise<McpServerRow> {
  const session = await requireSession();

  const [toggled] = await db
    .update(mcpServer)
    .set({ enabled: not(mcpServer.enabled), updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (!toggled) throw new Error("Not Found");

  return toggled;
}

/**
 * Renames an MCP server configuration for the authenticated user.
 *
 * @param id - UUID of the MCP server to rename; must be owned by the authenticated user.
 * @param name - The new name for the MCP server.
 * @returns The updated MCP server row with new name.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if server does not exist or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
export async function renameMcpServer(
  id: string,
  name: string,
): Promise<McpServerRow> {
  const session = await requireSession();

  const [renamed] = await db
    .update(mcpServer)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
    .returning();

  if (!renamed) throw new Error("Not Found");

  return renamed;
}
