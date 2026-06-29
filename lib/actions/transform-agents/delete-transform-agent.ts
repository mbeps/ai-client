"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

/**
 * Deletes a transform agent for the authenticated user.
 * Runs on server only — never call from client components.
 *
 * @param id - UUID of the agent to delete; must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if session is not authenticated.
 * @throws Error if agent is not found or user does not own it (returns "Not Found").
 * @throws Error if database deletion fails due to constraints or connection issues.
 * @see createTransformAgent to create a new agent.
 * @see updateTransformAgent to modify an agent.
 * @author Maruf Bepary
 */
export async function deleteTransformAgent(id: string): Promise<void> {
  const session = await requireSession();
  await db
    .delete(transformAgent)
    .where(
      and(
        eq(transformAgent.id, id),
        eq(transformAgent.userId, session.user.id),
      ),
    );
}
