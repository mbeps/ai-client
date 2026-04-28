import { notFound } from "next/navigation";
import { getChat } from "@/lib/actions/chats/get-chat";
import { buildChatFromRows } from "@/lib/actions/chats/build-chat";
import { ChatPageClient } from "@/components/chat/chat-page-client";

/**
 * Chat detail page within an assistant context — server component with validation.
 * Route parameters: `[id]` — assistant ID, `[chatId]` — chat ID to load.
 * Verifies chat belongs to assistant; returns 404 if mismatch or chat not found.
 * Renders full chat interface with message tree, streaming, artifacts, and MCP tools.
 *
 * @see AssistantPage for parent assistant view
 * @see ProjectChatPage for equivalent project-scoped chat page
 */
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
