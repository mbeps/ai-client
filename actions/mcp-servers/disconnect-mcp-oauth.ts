"use server";

import { z } from "zod";
import { db } from "@/drizzle/db";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { deleteMcpOAuthCredential } from "@/lib/mcp/oauth/mcp-oauth-credentials";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const disconnectMcpOAuthSchema = z.object({
  serverId: z.string().min(1, "Server ID is required"),
});

export type DisconnectMcpOAuthInput = z.infer<typeof disconnectMcpOAuthSchema>;

/**
 * Disconnects OAuth for an MCP server by clearing all per-user credentials,
 * tokens, and registration data for the server.
 *
 * @param input - Contains serverId
 * @returns Success result
 * @author Maruf Bepary
 */
export const disconnectMcpOAuth = defineAction(
  async (
    input: DisconnectMcpOAuthInput,
  ): Promise<Result<{ success: boolean }, CommonError>> => {
    const session = await requireSession();

    const parsed = disconnectMcpOAuthSchema.safeParse(input);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      });
    }

    const { serverId } = parsed.data;

    await deleteMcpOAuthCredential(db, {
      userId: session.user.id,
      serverId,
    });

    return ok({ success: true });
  },
);
