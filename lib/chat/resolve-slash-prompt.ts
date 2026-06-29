import { PROMPTS } from "@/constants/prompts";
import type { Prompt } from "@/types/prompt/prompt";

/**
 * Resolves a slash-command prompt by ID, prepending its content to the user's message.
 *
 * @param promptId - The prompt ID to look up.
 * @param userContent - The user's original message content.
 * @param prompts - The list of available prompts from the store.
 * @returns The composed full content (prompt + separator + userContent).
 * @author Maruf Bepary
 */
export function resolveSlashPrompt(
  promptId: string,
  userContent: string,
  prompts: Prompt[],
): {
  fullContent: string;
  metadata: { promptId: string; userContent: string };
} {
  const selectedPrompt = prompts.find((p) => p.id === promptId);
  if (!selectedPrompt) {
    return { fullContent: userContent, metadata: { promptId, userContent } };
  }

  return {
    fullContent:
      selectedPrompt.content +
      PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
      userContent,
    metadata: { promptId, userContent },
  };
}
