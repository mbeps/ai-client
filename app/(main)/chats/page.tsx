import { listChats } from "@/lib/actions/chats/list-chats";
import { ChatsClient } from "./_components/chats-client";
import { chatRowToStore } from "@/lib/store/mappers/chat";
import type { ChatRow } from "@/types/chat-row";

/**
 * Chats listing page — server component fetching all user chats from database.
 * Displays searchable grid of chat cards with options to create new chats.
 * Gracefully handles fetch failures by rendering empty list.
 *
 * @see ChatsClient for client-side rendering and interactions
 */
export default async function ChatsPage() {
  const rows = await listChats().catch(() => [] as ChatRow[]);
  const chats = rows.map(chatRowToStore);
  return <ChatsClient initialChats={chats} />;
}
