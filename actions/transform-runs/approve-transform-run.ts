"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { inngest } from "@/lib/inngest/client";

/**
 * Server action to approve a paused transform run review gate via Inngest.
 * Validates ownership and dispatches the approval event.
 *
 * @param runId - UUID of the transformation run to approve
 * @returns Resolves when the Inngest approval event is dispatched
 * @throws {Error} When run is not found or not owned by user
 * @author Maruf Bepary
 */
export async function approveTransformRunAction(runId: string) {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(transformRun)
    .where(
      and(eq(transformRun.id, runId), eq(transformRun.userId, session.user.id)),
    );

  if (!row) throw new Error("Transform run not found");

  await inngest.send({
    name: "workflows/transform.approved",
    data: { runId },
  });

  return { success: true };
}
