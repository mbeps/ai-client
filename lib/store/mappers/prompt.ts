import type { PromptRow } from "@/types/prompt-row";
import type { Prompt } from "@/types/prompt";

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
    title: row.title,
    shortcut: row.shortcut,
    content: row.content,
    updatedAt: new Date(row.updatedAt),
  };
}
