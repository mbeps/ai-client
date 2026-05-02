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

  const { text, sourceLanguage, targetLanguage, modelId = DEFAULT_MODEL } = parsed.data;

  const sourceDesc = sourceLanguage === "auto" ? "automatically detected language" : sourceLanguage;
  
  const prompt = PROMPTS.WORKFLOWS.TRANSLATE(sourceDesc, targetLanguage, text);

  try {
    const { text: translatedText } = await generateText({
      model: openrouter.chat(modelId),
      prompt,
    });

    return translatedText.trim();
  } catch (error) {
    console.error("[Translate Action Error]:", error);
    throw new Error("Failed to translate text. Please try again.");
  }
}
