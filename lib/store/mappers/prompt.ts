import type { PromptRow } from "@/types/prompt/prompt-row";
import type { Prompt } from "@/types/prompt/prompt";

/**
 * Converts a PromptRow database record to the Zustand Prompt store shape.
 * Transforms database timestamp to JavaScript Date object for updatedAt field.
 * Preserves all non-null fields as-is; used for slash-command palette hydration.
 *
 * @param row - Database PromptRow with full prompt metadata
 * @returns Prompt object ready for store insertion
 * @see loadPrompts in prompt-slice.ts for complete store hydration
 * @author Maruf Bepary
 */
export function promptRowToStore(row: PromptRow): Prompt {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    shortcut: row.shortcut,
    content: row.content,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
