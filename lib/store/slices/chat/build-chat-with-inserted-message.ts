import { insertMessage } from "@/lib/chat/insert-message";
import type { AddMessageParams } from "@/types/chat/add-message-params";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";

/**
 * Pure state builder for inserting a message into a Chat domain object.
 * Returns an updated Chat with the new message inserted, updated timestamp, and updated currentLeafId.
 *
 * @param chat - Existing Chat domain object
 * @param params - Message attributes
 * @param newMessageId - Unique ID for the new message
 * @returns Updated Chat domain object
 * @author Maruf Bepary
 */
export function buildChatWithInsertedMessage(
  chat: Chat,
  params: AddMessageParams,
  newMessageId: string,
): Chat {
  const newMessage: Message = {
    id: newMessageId,
    role: params.role,
    content: params.content,
    createdAt: new Date(),
    parentId: params.parentId,
    childrenIds: [],
    metadata: params.metadata ?? null,
    reasoning: params.reasoning ?? undefined,
    attachments: params.attachments ?? [],
  };

  const updatedMessages = insertMessage(chat.messages, newMessage);

  return {
    ...chat,
    messages: updatedMessages,
    currentLeafId: newMessageId,
    updatedAt: new Date(),
  };
}
