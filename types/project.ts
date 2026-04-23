/**
 * A grouped workspace that links chats to a shared system prompt and knowledge bases.
 */
export type Project = {
  id: string;
  name: string;
  description: string;
  isPinned: boolean;
  updatedAt: Date;
  globalPrompt: string;
  knowledgebases: string[];
};
