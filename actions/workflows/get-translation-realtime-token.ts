"use server";

import { and, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { workflowTranslation } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { inngest } from "@/lib/inngest/client";
import { translationChannel } from "@/lib/inngest/translation-channel";

/**
 * Server action to mint an authorized subscription token for the translation Inngest Realtime channel.
 * Authorizes user access before returning the token.
 *
 * @param translationId - Target translation record ID.
 * @returns Client subscription token string.
 * @author Maruf Bepary
 */
export async function getTranslationRealtimeToken(translationId: string) {
  const session = await requireSession();

  const [row] = await db
    .select({ id: workflowTranslation.id })
    .from(workflowTranslation)
    .where(
      and(
        eq(workflowTranslation.id, translationId),
        eq(workflowTranslation.userId, session.user.id),
      ),
    );

  if (!row) throw new Error("Unauthorized");

  const ch = translationChannel({ translationId });

  return getClientSubscriptionToken(inngest, {
    channel: ch,
    topics: ["stream"],
  });
}
