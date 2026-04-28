import type { Message } from "./message";

/**
 * Represents a single conversation thread with branching message tree support.
 * Each chat is a container for a hierarchical message structure where users can explore
 * alternative response branches. Chats can be associated with a project (workspace) and
 * an assistant (AI persona) for shared context and personalized behaviour.
 *
 * @see Message for the structure of individual messages in the tree
 * @see Project for workspace context
 * @see Assistant for AI persona configuration
 * @author Maruf Bepary
 */
export type Chat = {
  /** Unique identifier for this chat (UUID). */
  id: string;

  /** User-visible chat title, typically auto-generated or user-edited. */
  title: string;

  /** Optional reference to the parent project for shared system prompts. */
  projectId?: string;

  /** Optional reference to the AI assistant (persona) for this chat. */
  assistantId?: string;

  /** Cached project name for optimistic UI rendering without additional lookups. */
  projectName?: string;

  /** Cached assistant name for optimistic UI rendering without additional lookups. */
  assistantName?: string;

  /** Timestamp of the last chat interaction (message creation, edit, or deletion). */
  updatedAt: Date;

  /**
   * All messages in this chat keyed by message ID, forming a branching tree.
   * Child messages maintain references to parent IDs, enabling multi-path conversations.
   */
  messages: Record<string, Message>;

  /**
   * ID of the currently displayed message path leaf.
   * Tracks which branch is "active" for rendering and continuation.
   * Null when chat is empty.
   */
  currentLeafId: string | null;
};
