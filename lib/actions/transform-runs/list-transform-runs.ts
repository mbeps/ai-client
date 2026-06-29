"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

/**
 * Lists transform runs for a specific transform agent.
 * Returns runs ordered by most recently created first.
 * Use this to display history of agent executions.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param agentId - UUID of the transform agent; must be owned by the authenticated user.
 * @returns Array of runs for the specified agent sorted by createdAt descending; empty array if no runs exist.
 * @throws Error if session is not authenticated.
 * @throws Error if database query fails due to connection issues.
 * @see getTransformRun to fetch details for a specific run.
 * @author Maruf Bepary
 */
export async function listTransformRuns(
  agentId: string,
): Promise<TransformRunRow[]> {
  const session = await requireSession();
  return db
    .select()
    .from(transformRun)
    .where(
      and(
        eq(transformRun.agentId, agentId),
        eq(transformRun.userId, session.user.id),
      ),
    )
    .orderBy(desc(transformRun.createdAt));
}
