"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { inngest } from "@/lib/inngest/client";

/**
 * Server action to start executing a transform run via Inngest background job.
 * Validates ownership and dispatches the execution event.
 *
 * @author Maruf Bepary
 */
export async function startTransformRunAction(runId: string) {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(transformRun)
    .where(
      and(eq(transformRun.id, runId), eq(transformRun.userId, session.user.id)),
    );

  if (!row) throw new Error("Transform run not found");

  await inngest.send({
    name: "workflows/transform.execute",
    data: {
      runId,
      userId: session.user.id,
      startFromStep: row.currentStepIndex ?? 0,
    },
  });

  return { success: true };
}
