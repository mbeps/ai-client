import { createOpenAI } from "@ai-sdk/openai";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-provider";

/**
 * Interface for the AI provider instance returned by `getAiProvider`.
 * Uses the OpenAI compatibility layer for OpenRouter.
 */
export type AiProvider = ReturnType<typeof createOpenAI>;

/**
 * Backward-compatible provider resolver for legacy call sites.
 * Delegates to the provider registry default chat model resolver.
 */
export async function getAiProvider(userId: string): Promise<AiProvider> {
  const resolved = await resolveDefaultChatProvider(userId);
  return resolved.sdkProvider;
}
