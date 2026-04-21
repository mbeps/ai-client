import { notFound } from "next/navigation";
import { getChat } from "@/lib/actions/chats/get-chat";
import { buildChatFromRows } from "@/lib/actions/chats/build-chat";
import { ChatPageClient } from "@/components/chat/chat-page-client";

export default async function ProjectChatPage({
  params,
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  const { id, chatId } = await params;

  try {
    const data = await getChat(chatId);
    const chat = buildChatFromRows(data);
    if (chat.projectId !== id) {
      notFound();
    }
    return <ChatPageClient initialChat={chat} />;
  } catch {
    notFound();
  }
}
