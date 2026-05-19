"use server";

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";
import { requireSession } from "../require-session";
import { DEFAULT_MODEL } from "@/constants/models";
import { translateRequestSchema } from "@/schemas/workflows";
import { PROMPTS } from "@/constants/prompts";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: env.OPENROUTER_API_KEY,
});

/**
 * Server action to translate text using AI.
 *
 * @param input - The translation request data.
 * @returns The translated text.
 * @throws 401 if unauthorized.
 * @throws Error if validation fails.
 */
export async function translateText(input: unknown) {
  await requireSession();

  const parsed = translateRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid translation request: " + parsed.error.message);
  }

  const {
    text: originalText,
    sourceLanguage,
    targetLanguage,
    modelId = DEFAULT_MODEL,
    attachment,
  } = parsed.data;

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
      model: openrouter.chat(modelId),
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
    console.error("[Translate Action Error]:", error);
    throw new Error("Failed to translate text. Please try again.");
  }
}
