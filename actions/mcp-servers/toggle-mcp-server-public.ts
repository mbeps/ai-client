"use server";

import { and, eq, not } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";
import type { Result } from "@/types/result";

/**
 * Toggles the public/private visibility of an MCP server for the authenticated user.
 * Flips the isPublic boolean to control whether other users can discover and import this server.
 * IMPORTANT: When toggling to public, sensitive data like API keys or custom headers should NOT be included.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the MCP server to toggle; must be owned by the authenticated user.
 * @returns Result containing the updated MCP server record with toggled isPublic status.
 * @see createMcpServer to add a new server.
 * @see listPublicMcpServers to view public servers.
 * @author Maruf Bepary
 */
export const toggleMcpServerPublic = defineAction(
  async (id: string): Promise<Result<McpServerRow, CommonError>> => {
    const session = await requireSession();

    const [toggled] = await db
      .update(mcpServer)
      .set({ isPublic: not(mcpServer.isPublic), updatedAt: new Date() })
      .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
      .returning();

    if (!toggled) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(toggled);
  },
);
