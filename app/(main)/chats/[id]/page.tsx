import { notFound } from "next/navigation";
import { getChat } from "@/actions/chats/get-chat";
import { ChatPageClient } from "@/components/chat/chat-page-client";
import { buildChatFromRows } from "@/lib/chat/message-tree-utils";

/**
 * Chat detail page with streaming message view and AI interaction.
 * Route: /chats/[id]. Server-renders chat history and client hydrates with real-time streaming.
 * URL parameter [id]: chat UUID. Optional search param ?msg=content pre-populates chat input.
 * Protected route — requires ownership of the chat; returns 404 if not found.
 *
 * @author Maruf Bepary
 * @param params - Promise resolving to {id: chatId}
 * @param searchParams - Promise resolving to {msg?: string} for pre-filled message
 * @see ChatPageClient for streaming and branching UI.
 */
export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { id: chatId } = await params;
  const { msg } = await searchParams;

  const res = await getChat(chatId);
  if (!res.ok) {
    notFound();
  }

  const chat = buildChatFromRows(res.value);

  return <ChatPageClient initialChat={chat} initialMessage={msg} />;
}
