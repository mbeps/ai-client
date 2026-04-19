import { getChat } from "@/lib/actions/chats/get-chat";
import { ChatPageClient } from "./_components/chat-page-client";
import type { Chat, Message } from "@/lib/store";
import type { ChatWithMessages } from "@/lib/actions/chats/types";

function buildChatFromRows(row: ChatWithMessages): Chat {
  const messages: Record<string, Message> = {};

  for (const m of row.messages) {
    messages[m.id] = {
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: new Date(m.createdAt),
      parentId: m.parentId,
      childrenIds: [],
    };
  }

  for (const m of row.messages) {
    if (m.parentId && messages[m.parentId]) {
      messages[m.parentId].childrenIds.push(m.id);
    }
  }

  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    updatedAt: new Date(row.updatedAt),
    messages,
    currentLeafId: row.currentLeafId,
  };
}

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { id: chatId } = await params;
  const { msg } = await searchParams;

  let chat: Chat;
  try {
    const data = await getChat(chatId);
    chat = buildChatFromRows(data);
  } catch {
    return (
      <div className="flex-1 p-6 text-muted-foreground">Chat not found.</div>
    );
  }

  return <ChatPageClient initialChat={chat} initialMessage={msg} />;
}
