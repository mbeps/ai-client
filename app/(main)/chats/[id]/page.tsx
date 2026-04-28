import { getChat } from "@/lib/actions/chats/get-chat";
import { buildChatFromRows } from "@/lib/actions/chats/build-chat";
import { ChatPageClient } from "@/components/chat/chat-page-client";
import { notFound } from "next/navigation";
import type { Chat } from "@/types/chat";

/**
 * Chat detail page with streaming message view and AI interaction.
 * Route: /chats/[id]. Server-renders chat history and client hydrates with real-time streaming.
 * URL parameter [id]: chat UUID. Optional search param ?msg=content pre-populates chat input.
 * Protected route — requires ownership of the chat; returns 404 if not found.
 *
 * @param params - Promise resolving to {id: chatId}
 * @param searchParams - Promise resolving to {msg?: string} for pre-filled message
 * @returns Chat interface with branching message tree, artifacts, and AI responses.
 * @throws 404 if chat not found or user lacks ownership.
 * @see ChatPageClient for streaming and branching UI.
 * @author Maruf Bepary
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

  let chat: Chat;
  try {
    const data = await getChat(chatId);
    chat = buildChatFromRows(data);
  } catch {
    notFound();
  }

  return <ChatPageClient initialChat={chat} initialMessage={msg} />;
}
