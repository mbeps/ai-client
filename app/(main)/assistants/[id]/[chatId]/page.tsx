import { notFound, redirect } from "next/navigation";
import { buildChatFromRows } from "@/actions/chats/build-chat";
import { getChat } from "@/actions/chats/get-chat";
import { ChatPageClient } from "@/components/chat/chat-page-client";
import { ROUTES } from "@/config/routes";
import type { Chat } from "@/types/chat/chat";

/**
 * Chat detail page within an assistant context — server component with validation.
 * Route parameters: `[id]` — assistant ID, `[chatId]` — chat ID to load.
 * Verifies chat belongs to assistant; redirects to standalone chat if unlinked/mismatched, returns 404 if chat not found.
 * Renders full chat interface with message tree, streaming, artifacts, and MCP tools.
 *
 * @author Maruf Bepary
 * @see AssistantPage for parent assistant view
 * @see ProjectChatPage for equivalent project-scoped chat page
 */
export default async function AssistantChatPage({
  params,
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  const { id, chatId } = await params;

  let chat: Chat;
  try {
    const data = await getChat(chatId);
    chat = buildChatFromRows(data);
  } catch {
    notFound();
  }

  if (chat.assistantId !== id) {
    redirect(ROUTES.CHATS.detail(chatId));
  }

  return <ChatPageClient initialChat={chat} />;
}
