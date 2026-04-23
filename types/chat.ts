import type { Message } from "./message";

/**
 * A conversation thread backed by a branching message tree.
 */
export type Chat = {
  id: string;
  title: string;
  projectId?: string;
  assistantId?: string;
  projectName?: string;
  assistantName?: string;
  updatedAt: Date;
  messages: Record<string, Message>;
  currentLeafId: string | null;
};
