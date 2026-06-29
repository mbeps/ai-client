"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";

/**
 * Fetches all transform agents configured by the authenticated user.
 * Returns agents ordered by most recently created first.
 * Use this to display available transform agents in selection dropdowns or list views.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Array of all user's transform agents sorted by createdAt descending; empty array if no agents exist.
 * @throws Error if session is not authenticated.
 * @throws Error if database query fails due to connection issues.
 * @see createTransformAgent to create a new agent.
 * @see getTransformAgent to fetch details for a single agent.
 * @author Maruf Bepary
 */
export async function listTransformAgents(): Promise<TransformAgentRow[]> {
  const session = await requireSession();
  return db
    .select()
    .from(transformAgent)
    .where(eq(transformAgent.userId, session.user.id))
    .orderBy(desc(transformAgent.updatedAt));
}
