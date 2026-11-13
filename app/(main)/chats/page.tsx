import { listChats } from "@/actions/chats/list-chats";
import { ChatsClient } from "@/app/(main)/chats/_components/chats-client";
import type { ChatRow } from "@/types/chat/chat-row";

/**
 * Chats listing page — server component fetching all user chats from database.
 * Displays searchable grid of chat cards with options to create new chats.
 * Gracefully handles fetch failures by rendering empty list.
 *
 * @see ChatsClient for client-side rendering and interactions
 */
export default async function ChatsPage() {
  const res = await listChats();
  const rows: ChatRow[] = res.ok ? res.value : [];
  const chats = rows.map((row) => ({
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    agentId: row.agentId ?? undefined,
    assistantId: row.agentId ?? undefined,
    knowledgebaseId: row.knowledgebaseId ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    messages: {},
    currentLeafId: row.currentLeafId ?? null,
  }));
  return <ChatsClient initialChats={chats} />;
}
