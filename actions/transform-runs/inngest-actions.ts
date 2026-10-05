"use server";

import { and, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { transformRunChannel } from "@/lib/inngest/channels";
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

/**
 * Server action to approve a paused transform run review gate via Inngest.
 * Validates ownership and dispatches the approval event.
 *
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

/**
 * Server action to mint a short-lived subscription token for the transform run Realtime channel.
 * Authorizes user access before returning the token.
 *
 * @author Maruf Bepary
 */
export async function getTransformRunRealtimeToken(runId: string) {
  const session = await requireSession();

  const [row] = await db
    .select({ id: transformRun.id })
    .from(transformRun)
    .where(
      and(eq(transformRun.id, runId), eq(transformRun.userId, session.user.id)),
    );

  if (!row) throw new Error("Unauthorized");

  const trCh = transformRunChannel({ runId });

  return getClientSubscriptionToken(inngest, {
    channel: trCh,
    topics: ["progress"],
  });
}
