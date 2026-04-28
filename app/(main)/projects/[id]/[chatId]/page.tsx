import { notFound } from "next/navigation";
import { getChat } from "@/lib/actions/chats/get-chat";
import { buildChatFromRows } from "@/lib/actions/chats/build-chat";
import { ChatPageClient } from "@/components/chat/chat-page-client";

/**
 * Chat detail page within a project context — server component with validation.
 * Route parameters: `[id]` — project ID, `[chatId]` — chat ID to load.
 * Verifies chat belongs to project; returns 404 if mismatch or chat not found.
 * Renders full chat interface with message tree, streaming, artifacts, and MCP tools.
 *
 * @see ProjectPage for parent project view
 * @see AssistantChatPage for equivalent assistant-scoped chat page
 */
export default async function ProjectChatPage({
  params,
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  const { id, chatId } = await params;

  let chat;
  try {
    const data = await getChat(chatId);
    chat = buildChatFromRows(data);
    if (chat.projectId !== id) {
      notFound();
    }
  } catch {
    notFound();
  }

  return <ChatPageClient initialChat={chat!} />;
}
