import { notFound } from "next/navigation";
import { getChat } from "@/lib/actions/chats/get-chat";
import { buildChatFromRows } from "@/lib/actions/chats/build-chat";
import { ChatPageClient } from "@/components/chat/chat-page-client";

export default async function AssistantChatPage({
  params,
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  const { id, chatId } = await params;

  let chat;
  try {
    const data = await getChat(chatId);
    chat = buildChatFromRows(data);
    if (chat.assistantId !== id) {
      notFound();
    }
  } catch {
    notFound();
  }

  return <ChatPageClient initialChat={chat!} />;
}
