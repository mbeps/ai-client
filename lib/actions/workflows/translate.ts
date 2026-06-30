"use server";
import { logger } from "@/lib/logger";

import { generateText } from "ai";
import { requireSession } from "@/lib/auth/require-session";
import { translateRequestSchema } from "@/schemas/workflows/workflows";
import { PROMPTS } from "@/constants/prompts";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { resolveProviderForModel } from "@/lib/chat/resolve-provider-for-model";
import { ProviderNotConfiguredError, RateLimitError } from "@/constants/errors";
import {
  isRateLimitError,
  normalizeRateLimitMessage,
} from "@/lib/utils/error-utils";

/**
 * Server action to translate text using AI with optional source language detection.
 * Resolves the appropriate chat model (user-specified or default) and constructs a translation prompt.
 * Handles rate-limit errors gracefully and returns structured result.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param input - The translation request data validated against translateRequestSchema (text, sourceLanguage, targetLanguage required; modelId, attachment optional).
 * @returns Object with translated text and metadata (originalText, sourceLanguage, targetLanguage, modelId).
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
    throw new Error("Invalid translation request: " + parsed.error.message);
  }

  const {
    text: originalText,
    sourceLanguage,
    targetLanguage,
    modelId,
    attachment,
  } = parsed.data;

  const resolved = modelId
    ? await resolveProviderForModel(session.user.id, modelId)
    : await resolveDefaultChatProvider(session.user.id);

  const sourceDesc =
    sourceLanguage === "auto" || sourceLanguage === "Auto Detect"
      ? "automatically detected language"
      : sourceLanguage;

  const isImage = attachment?.type === "image";
  const sourceText = attachment?.extractedText || originalText || "";

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
                    type: "image" as const,
                    image: attachment.dataUrl,
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
    logger.error("[Translate Action Error]:", error);
    throw new Error("Failed to translate text. Please try again.");
  }
}
