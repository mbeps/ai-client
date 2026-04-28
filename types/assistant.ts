/**
 * Represents a custom AI persona with a system prompt, tools, and knowledge bases.
 * Assistants enable user-defined AI behavior by combining a system prompt, optional tools,
 * and linked knowledge bases. When selected for a chat, the assistant's prompt is prepended
 * to the AI request to shape responses consistently.
 *
 * @see Chat for assistant reference in conversations
 * @see Project for team-level system prompts
 * @author Maruf Bepary
 */
export type Assistant = {
  /** Unique identifier for this assistant (UUID). */
  id: string;

  /** Human-readable name displayed in selection menus and chat headers. */
  name: string;

  /** Brief description of the assistant's purpose and capabilities. */
  description: string;

  /** System prompt prepended to all AI requests when this assistant is selected. */
  prompt: string;

  /**
   * Array of MCP tool IDs available to this assistant.
   * Empty if no tools are enabled; controls which functions the AI can call.
   */
  tools: string[];

  /**
   * Array of knowledge base IDs linked to this assistant.
   * Knowledge bases provide context injected into the AI prompt.
   */
  knowledgebases: string[];

  /** Optional avatar URL for visual identification in the UI. */
  avatar?: string;

  /** Timestamp of the last modification to this assistant's configuration. */
  updatedAt: Date;
};
