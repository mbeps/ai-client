/**
 * A reusable prompt snippet that can be inserted into the chat input via shortcuts.
 */
export type Prompt = {
  id: string;
  title: string;
  shortcut: string;
  content: string;
  updatedAt: Date;
};
