import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@/drizzle/db";
import { userSettings } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/utils/encryption";
import { MISSING_API_KEY_ERROR } from "@/lib/constants/errors";

/**
 * Interface for the AI provider instance returned by `getAiProvider`.
 * Uses the OpenAI compatibility layer for OpenRouter.
 */
export type AiProvider = ReturnType<typeof createOpenAI>;

/**
 * Initializes and returns a configured AI provider (OpenRouter) for a specific user.
 * Fetches the user's encrypted API key from the database and decrypts it.
 *
 * @param userId - The unique ID of the user whose settings to fetch.
 * @returns A configured OpenAI provider instance pointing to OpenRouter.
 * @throws {Error} If user settings or the OpenRouter API key are missing.
 * @author Maruf Bepary
 */
export async function getAiProvider(userId: string): Promise<AiProvider> {
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (!settings || !settings.openrouterKey) {
    throw new Error(MISSING_API_KEY_ERROR);
  }

  try {
    const rawKey = decrypt(settings.openrouterKey);

    return createOpenAI({
      apiKey: rawKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
  } catch (error) {
    console.error("Failed to decrypt OpenRouter key:", error);
    throw new Error(
      "Failed to initialize AI provider. Your API key might be invalid or corrupted.",
    );
  }
}
