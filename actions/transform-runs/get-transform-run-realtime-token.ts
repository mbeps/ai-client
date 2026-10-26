"use server";

import { and, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { inngest } from "@/lib/inngest/client";
import { transformRunChannel } from "@/lib/inngest/transform-run-channel";

/**
 * Server action to mint a short-lived subscription token for the transform run Realtime channel.
 * Authorizes user access before returning the token.
 *
 * @param runId - UUID of the transformation run to subscribe to
 * @returns Realtime channel subscription token string
 * @throws {Error} When transform run is not found or access denied
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
