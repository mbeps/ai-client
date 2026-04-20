import { listChats } from "@/lib/actions/chats/list-chats";
import { ChatsClient } from "./_components/chats-client";
import type { Chat } from "@/lib/store";
import type { ChatRow } from "@/lib/actions/chats/types";

function chatRowToChat(row: ChatRow): Chat {
  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    updatedAt: new Date(row.updatedAt),
    messages: {},
    currentLeafId: row.currentLeafId,
  };
}

export default async function ChatsPage() {
  const rows = await listChats().catch(() => [] as ChatRow[]);
  const chats = rows.map(chatRowToChat);
  return <ChatsClient initialChats={chats} />;
}
