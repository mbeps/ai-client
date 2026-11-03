import type { Attachment } from "@/types/attachment/attachment";

/**
 * Parameters for adding a new message to a chat conversation.
 * Matches the input signature of AppState.addMessage while omitting chatId.
 *
 * @author Maruf Bepary
 */
export interface AddMessageParams {
  role: "user" | "assistant";
  content: string;
  parentId: string | null;
  id?: string;
  metadata?: string | null;
  attachments?: Attachment[];
  reasoning?: string;
}
