import type { Attachment } from "./attachment";

/**
 * A single message node within a branching conversation tree.
 */
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  parentId: string | null;
  childrenIds: string[];
  metadata?: string | null;
  reasoning?: string;
  attachments?: Attachment[];
};
