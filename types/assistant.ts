/**
 * A custom AI persona with a system prompt, enabled tools, and linked knowledge bases.
 */
export type Assistant = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  tools: string[];
  knowledgebases: string[];
  avatar?: string;
  updatedAt: Date;
};
