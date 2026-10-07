"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { transformAgent, transformRun } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { inngest } from "@/lib/inngest/client";

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
  const validatedAgentId = id;

  const activeRuns = await db
    .select({ id: transformRun.id })
    .from(transformRun)
    .where(
      and(
        eq(transformRun.agentId, validatedAgentId),
        inArray(transformRun.status, [
          "running",
          "paused",
          "waiting_approval",
          "awaiting_review",
        ] as any),
      ),
    );

  if (activeRuns.length > 0) {
    await inngest.send(
      activeRuns.map((r) => ({
        name: "workflows/transform.cancel",
        data: { runId: r.id },
      })),
    );
  }

  await db
    .delete(transformAgent)
    .where(
      and(
        eq(transformAgent.id, validatedAgentId),
        eq(transformAgent.userId, session.user.id),
      ),
    );
}
