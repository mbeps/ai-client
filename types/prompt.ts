/**
 * Represents a reusable prompt snippet accessible via slash-commands in the chat input.
 * Prompts enable power users to quickly insert predefined content (system instructions,
 * code templates, checklists, etc.) using the shortcut syntax /shortcut-name.
 * Shortcuts are hidden from the final AI request but prepend content before sending.
 *
 * @author Maruf Bepary
 */
export type Prompt = {
  /** Unique identifier for this prompt (UUID). */
  id: string;

  /** Human-readable title displayed in the slash-command palette. */
  title: string;

  /** Trigger text for the slash-command (e.g., "debug" for /debug). */
  shortcut: string;

  /** Prompt content inserted into the AI request when the shortcut is invoked. */
  content: string;

  /** Timestamp of the last modification to this prompt. */
  updatedAt: Date;
};
