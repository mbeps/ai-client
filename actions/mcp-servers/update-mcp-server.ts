"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schemas/mcp-server-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { buildServerConfig } from "@/lib/mcp/build-server-config";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import {
  type UpdateMcpServer,
  updateMcpServerSchema,
} from "@/schemas/providers/mcp-server";
import type { CommonError } from "@/types/error/common-error";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";
import type { Result } from "@/types/result";

/**
 * Updates an existing MCP server configuration for the authenticated user.
 * Validates all configuration fields.
 *
 * @param id - UUID of the MCP server to update; must be owned by the authenticated user.
 * @param data - Updated server configuration validated against updateMcpServerSchema.
 * @returns Result containing updated MCP server row.
 * @author Maruf Bepary
 */
export const updateMcpServer = defineAction(
  async (
    id: string,
    data: UpdateMcpServer,
  ): Promise<Result<McpServerRow, CommonError>> => {
    const session = await requireSession();

    const parsed = updateMcpServerSchema.parse(data);

    const values = buildServerConfig(parsed);
    // SEC-07: empty string means "no change" — preserve existing sensitive values
    const updateFields = { ...values };
    if (parsed.headers === "") {
      delete (updateFields as any).headers;
    }
    if (parsed.oauthClientSecret === "") {
      delete (updateFields as any).oauthClientSecret;
    }

    const [updated] = await db
      .update(mcpServer)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(and(eq(mcpServer.id, id), eq(mcpServer.userId, session.user.id)))
      .returning();

    if (!updated) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(updated);
  },
);
