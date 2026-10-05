import { PROMPTS } from "@/config/prompts";
import type { Prompt } from "@/types/prompt/prompt";

/**
 * Resolves multiple slash-command prompts by IDs, prepending their contents in order to the user's message.
 *
 * @param promptIds - The prompt IDs to look up.
 * @param userContent - The user's original message content.
 * @param prompts - The list of available prompts from the store.
 * @returns The composed full content (prompts joined by separator + userContent).
 * @author Maruf Bepary
 */
export function resolveSlashPrompts(
  promptIds: string[],
  userContent: string,
  prompts: Prompt[],
): {
  fullContent: string;
  metadata: { promptIds: string[]; promptId?: string; userContent: string };
} {
  if (promptIds.length === 0) {
    return {
      fullContent: userContent,
      metadata: { promptIds: [], userContent },
    };
  }

  const promptChunks: string[] = [];
  for (const pid of promptIds) {
    const selectedPrompt = prompts.find((p) => p.id === pid);
    if (selectedPrompt?.content) {
      promptChunks.push(selectedPrompt.content);
    }
  }

  const fullContent =
    promptChunks.length > 0
      ? promptChunks.join(PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR) +
        PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
        userContent
      : userContent;

  return {
    fullContent,
    metadata: {
      promptIds,
      promptId: promptIds[0],
      userContent,
    },
  };
}

/**
 * Resolves a single slash-command prompt by ID, prepending its content to the user's message.
 * Maintained for backward compatibility.
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
  const result = resolveSlashPrompts([promptId], userContent, prompts);
  return {
    fullContent: result.fullContent,
    metadata: {
      promptId,
      userContent,
    },
  };
}
