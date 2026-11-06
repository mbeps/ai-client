"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

/**
 * Lists transform runs for a specific transform agent.
 * Returns runs ordered by most recently created first.
 * Use this to display history of agent executions.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param agentId - UUID of the transform agent; must be owned by the authenticated user.
 * @returns Array of runs for the specified agent sorted by createdAt descending.
 * @author Maruf Bepary
 */
export const listTransformRuns = defineAction(
  async (agentId: string): Promise<Result<TransformRunRow[], CommonError>> => {
    const session = await requireSession();
    const rows = await db
      .select()
      .from(transformRun)
      .where(
        and(
          eq(transformRun.agentId, agentId),
          eq(transformRun.userId, session.user.id),
        ),
      )
      .orderBy(desc(transformRun.createdAt));
    return ok(rows);
  },
);
