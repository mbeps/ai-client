"use server";

import { generateText } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { PROMPTS } from "@/config/prompts";
import { db } from "@/drizzle/db";
import { workflowTranslation } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { fetchProviderWithModel } from "@/lib/chat/fetch-provider-with-model";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";
import { ProviderNotConfiguredError, RateLimitError } from "@/lib/errors";
import { translationChannel } from "@/lib/inngest/channels";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { translateRequestSchema } from "@/schemas/workflows/workflows";

const log = getLogger(["app", "actions", "workflow"]);

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

  if (!isImage && !sourceText) {
    throw new Error(
      "No text found to translate. Please provide text or an attachment with readable text.",
    );
  }

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

/**
 * Synchronous Server Action to translate text using AI with optional source language detection.
 * Resolves the appropriate chat model (user-specified or default) and constructs a translation prompt.
 *
 * @param input - The translation request data validated against translateRequestSchema.
 * @returns Translated text string.
 * @throws 401 Unauthorized if user is not authenticated.
 * @throws ValidationError if input fails schema validation.
 * @throws ProviderNotConfiguredError if no chat model is available.
 * @throws RateLimitError if provider rate limit is exceeded.
 * @author Maruf Bepary
 */
export async function translateText(input: unknown) {
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

  if (!isImage && !sourceText) {
    throw new Error(
      "No text found to translate. Please provide text or an attachment with readable text.",
    );
  }

  const resolved = modelId
    ? await fetchProviderWithModel(session.user.id, { modelId })
    : await resolveDefaultChatProvider(session.user.id);

  const sourceDesc =
    sourceLanguage === "auto" || sourceLanguage === "Auto Detect"
      ? "automatically detected language"
      : sourceLanguage;

  const prompt = PROMPTS.WORKFLOWS.TRANSLATE(
    sourceDesc,
    targetLanguage,
    sourceText,
    isImage,
  );

  try {
    const { text: translatedText } = await generateText({
      model: resolved.sdkProvider.chat(resolved.modelId),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...(isImage && attachment?.dataUrl
              ? [
                  {
                    type: "file" as const,
                    data: attachment.dataUrl,
                    mediaType: attachment.mimeType ?? "image",
                  },
                ]
              : []),
          ],
        },
      ],
    });

    return translatedText.trim();
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) throw error;
    if (isRateLimitError(error)) {
      throw new RateLimitError(normalizeRateLimitMessage(error));
    }
    log.error("Translation action failed: {error}", {
      error: error instanceof Error ? error.message : String(error),
      userId: session.user.id,
    });
    throw new Error("Failed to translate text. Please try again.");
  }
}
