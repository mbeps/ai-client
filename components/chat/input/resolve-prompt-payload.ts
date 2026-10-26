/**
 * Normalizes prompt IDs to an array if non-empty, or undefined if empty.
 *
 * @param promptIds - Array of prompt ID strings
 * @returns Array of prompt IDs or undefined if empty
 */
export function resolvePromptPayload(
  promptIds: string[],
): string[] | undefined {
  return promptIds.length > 0 ? promptIds : undefined;
}

