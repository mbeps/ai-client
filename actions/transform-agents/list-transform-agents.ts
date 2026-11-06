"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";

/**
 * Fetches all transform agents configured by the authenticated user.
 * Returns agents ordered by most recently created first.
 * Use this to display available transform agents in selection dropdowns or list views.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Result wrapping array of all user's transform agents sorted by createdAt descending.
 * @author Maruf Bepary
 */
export const listTransformAgents = defineAction(
  async (): Promise<Result<TransformAgentRow[], CommonError>> => {
    const session = await requireSession();
    const rows = await db
      .select()
      .from(transformAgent)
      .where(eq(transformAgent.userId, session.user.id))
      .orderBy(desc(transformAgent.updatedAt));

    return ok(rows as TransformAgentRow[]);
  },
);
