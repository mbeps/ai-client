import { notFound, redirect } from "next/navigation";
import { buildChatFromRows } from "@/actions/chats/build-chat";
import { getChat } from "@/actions/chats/get-chat";
import { ChatPageClient } from "@/components/chat/chat-page-client";
import { ROUTES } from "@/config/routes";
import type { Chat } from "@/types/chat/chat";

/**
 * Chat detail page within a project context — server component with validation.
 * Route parameters: `[id]` — project ID, `[chatId]` — chat ID to load.
 * Verifies chat belongs to project; redirects to standalone chat if unlinked/mismatched, returns 404 if chat not found.
 * Renders full chat interface with message tree, streaming, artifacts, and MCP tools.
 *
 * @author Maruf Bepary
 * @see ProjectPage for parent project view
 * @see AssistantChatPage for equivalent assistant-scoped chat page
 */
export default async function ProjectChatPage({
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

  if (chat.projectId !== id) {
    redirect(ROUTES.CHATS.detail(chatId));
  }

  return <ChatPageClient initialChat={chat} />;
}
