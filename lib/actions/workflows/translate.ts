"use server";

import { generateText } from "ai";
import { requireSession } from "../require-session";
import { DEFAULT_MODEL } from "@/constants/models";
import { translateRequestSchema } from "@/schemas/workflows";
import { PROMPTS } from "@/constants/prompts";
import { getAiProvider } from "@/lib/chat/get-ai-provider";

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
  const provider = await getAiProvider(session.user.id);

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
      model: provider.chat(modelId),
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
