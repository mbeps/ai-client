"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

/**
 * Fetches a single transform run with its full execution details for the authenticated user.
 * Validates run ownership before returning data.
 * Returns input, output, status, and execution metadata.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param runId - UUID of the run to retrieve; must be associated with an agent owned by the authenticated user.
 * @returns The transform run record with all execution details.
 * @throws Error if session is not authenticated.
 * @throws Error if run is not found or user does not own the associated agent (returns "Not Found").
 * @throws Error if database query fails due to connection issues.
 * @see listTransformRuns to fetch all runs for an agent.
 * @author Maruf Bepary
 */
export async function getTransformRun(
  id: string,
): Promise<TransformRunRow | null> {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(transformRun)
    .where(
      and(eq(transformRun.id, id), eq(transformRun.userId, session.user.id)),
    )
    .limit(1);
  return rows[0] ?? null;
}
