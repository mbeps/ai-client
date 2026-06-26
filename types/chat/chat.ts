import { z } from "zod";
import { chatSchema } from "@/schemas/chat/chat";
import type { Message } from "@/types/message/message";

/**
 * Represents a single conversation thread with branching message tree support.
 * Each chat is a container for a hierarchical message structure where users can explore
 * alternative response branches. Chats can be associated with a project (workspace) and
 * an assistant (AI persona) for shared context and personalized behaviour.
 *
 * @see Message for the structure of individual messages in the tree
 * @see Project for workspace context
 * @see Assistant for AI persona configuration
 */
export type Chat = z.infer<typeof chatSchema> & {
  /**
   * All messages in this chat keyed by message ID, forming a branching tree.
   * Child messages maintain references to parent IDs, enabling multi-path conversations.
   */
  messages: Record<string, Message>;
};
