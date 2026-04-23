import type { PromptRow } from "@/types/prompt-row";
import type { Prompt } from "@/types/prompt";

/**
 * Maps a PromptRow from the DB to the Zustand Prompt shape.
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
