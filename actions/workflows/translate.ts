"use server";

import { and, desc, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { workflowTranslation } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { translationChannel } from "@/lib/inngest/channels";
import { inngest } from "@/lib/inngest/client";
import { translateRequestSchema } from "@/schemas/workflows/workflows";

/**
 * Server action to initiate an asynchronous background translation via Inngest.
 * Persists the translation record to PostgreSQL, dispatches the Inngest workflow event,
 * and returns the unique translation ID for Realtime subscription.
 *
 * @param input - Translation request parameters matching translateRequestSchema.
 * @returns Object with the initiated translationId.
 * @throws 401 Unauthorized if user is not authenticated.
 * @throws Error if input fails validation or has empty text to translate.
 * @author Maruf Bepary
 */
export async function triggerTranslation(input: unknown) {
  const session = await requireSession();

  const parsed = translateRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid translation request: ${parsed.error.message}`);
  }

  const {
    text: originalText,
    sourceLanguage,
    targetLanguage,
    modelId,
    attachment,
  } = parsed.data;

  const isImage = attachment?.type === "image";
  const sourceText =
    originalText?.trim() || attachment?.extractedText?.trim() || "";

  const [row] = await db
    .insert(workflowTranslation)
    .values({
      userId: session.user.id,
      status: "pending",
      sourceLanguage,
      targetLanguage,
      sourceText,
      modelId: modelId || null,
      attachmentName: attachment?.name || null,
      attachmentType: attachment?.type || null,
    })
    .returning();

  await inngest.send({
    name: "workflows/translate.execute",
    data: {
      translationId: row.id,
      userId: session.user.id,
      sourceLanguage,
      targetLanguage,
      sourceText,
      modelId: modelId || undefined,
      isImage,
      attachmentDataUrl: isImage ? attachment?.dataUrl : undefined,
      attachmentMimeType: isImage ? attachment?.mimeType : undefined,
    },
  });

  return { translationId: row.id };
}

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

/**
 * Server action to fetch the user's latest translation run.
 * Used for rehydrating state when the user visits or refreshes the translation page.
 *
 * @returns Most recent WorkflowTranslation record or null.
 * @author Maruf Bepary
 */
export async function getLatestTranslationAction() {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(workflowTranslation)
    .where(eq(workflowTranslation.userId, session.user.id))
    .orderBy(desc(workflowTranslation.createdAt))
    .limit(1);

  return row ?? null;
}
