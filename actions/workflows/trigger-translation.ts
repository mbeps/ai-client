"use server";

import { db } from "@/drizzle/db";
import { workflowTranslation } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
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
