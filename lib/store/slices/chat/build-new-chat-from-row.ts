import { buildHydratedChat } from "@/lib/store/slices/chat/build-hydrated-chat";
import type { Chat } from "@/types/chat/chat";
import type { ChatRow } from "@/types/chat/chat-row";

/**
 * Pure state builder for constructing a new Chat object from a newly created database row.
 *
 * @param row - Database chat row returned from createChat server action
 * @returns New Chat domain object
 * @author Maruf Bepary
 */
export function buildNewChatFromRow(row: ChatRow): Chat {
  return buildHydratedChat(row, undefined, false);
}
