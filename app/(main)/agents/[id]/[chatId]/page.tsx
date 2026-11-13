import { notFound, redirect } from "next/navigation";
import { getChat } from "@/actions/chats/get-chat";
import { ChatPageClient } from "@/components/chat/chat-page-client";
import { ROUTES } from "@/config/routes";
import { buildChatFromRows } from "@/lib/chat/message-tree-utils";

/**
 * Chat detail page within an agent context (/agents/[id]/[chatId]).
 */
export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  const { id, chatId } = await params;

  const res = await getChat(chatId);
  if (!res.ok) {
    notFound();
  }

  const chat = buildChatFromRows(res.value);
  const chatAgentId = chat.agentId ?? chat.assistantId;

  if (chatAgentId !== id) {
    redirect(ROUTES.CHATS.detail(chatId));
  }

  return <ChatPageClient initialChat={chat} />;
}
