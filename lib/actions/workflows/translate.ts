"use server";

import { generateText } from "ai";
import { requireSession } from "../require-session";
import { translateRequestSchema } from "@/schemas/workflows/workflows";
import { PROMPTS } from "@/constants/prompts";
import {
  resolveDefaultChatProvider,
  resolveProviderForModel,
} from "@/lib/chat/resolve-provider";
import { ProviderNotConfiguredError } from "@/lib/constants/errors";

/**
 * Server action to translate text using AI.
 *
 * @param input - The translation request data.
 * @returns The translated text.
 * @throws 401 if unauthorized.
 * @throws Error if validation fails.
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
    console.error("[Translate Action Error]:", error);
    throw new Error("Failed to translate text. Please try again.");
  }
}
