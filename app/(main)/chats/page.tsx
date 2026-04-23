import { listChats } from "@/lib/actions/chats/list-chats";
import { ChatsClient } from "./_components/chats-client";
import { chatRowToStore } from "@/lib/store/mappers/chat";
import type { ChatRow } from "@/types/chat-row";

export default async function ChatsPage() {
  const rows = await listChats().catch(() => [] as ChatRow[]);
  const chats = rows.map(chatRowToStore);
  return <ChatsClient initialChats={chats} />;
}
