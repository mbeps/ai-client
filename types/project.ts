/**
 * Represents a workspace that groups related chats with shared system prompts and knowledge bases.
 * Projects organize conversations by context (e.g., project type, domain, or team).
 * All chats within a project inherit the global system prompt, which is prepended
 * before assistant-specific prompts during AI requests.
 *
 * @see Chat for chats grouped under this project
 * @see Assistant for individual AI personas (distinct from project-level prompts)
 * @author Maruf Bepary
 */
export type Project = {
  /** Unique identifier for this project (UUID). */
  id: string;

  /** Human-readable project name (e.g., "Customer Support", "Research Q4"). */
  name: string;

  /** Optional description of the project's purpose and scope. */
  description: string;

  /** Whether this project is pinned to the top of the projects list for quick access. */
  isPinned: boolean;

  /** Timestamp of the last modification to this project. */
  updatedAt: Date;

  /**
   * System prompt applied to all chats in this project.
   * Prepended before assistant-specific prompts in the AI request pipeline.
   */
  globalPrompt: string;

  /**
   * Array of knowledge base IDs linked to this project.
   * Provides shared context for all chats within the workspace.
   */
  knowledgebases: string[];
};
