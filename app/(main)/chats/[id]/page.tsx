import { getChat } from "@/lib/actions/chats/get-chat";
import { buildChatFromRows } from "@/lib/actions/chats/build-chat";
import { ChatPageClient } from "@/components/chat/chat-page-client";
import { notFound } from "next/navigation";
import type { Chat } from "@/lib/store";

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
    notFound();
  }

  return <ChatPageClient initialChat={chat} initialMessage={msg} />;
}
