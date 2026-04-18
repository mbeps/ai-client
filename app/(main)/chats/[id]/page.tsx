"use client";

import { ChatUI } from "@/components/chat/chat-ui";
import { useParams } from "next/navigation";

/**
 * Single chat view page that renders ChatUI for the chat matching the URL parameter.
 * Route: /chats/[id].
 *
 * @author Maruf Bepary
 */
export default function ChatPage() {
  const params = useParams();
  const chatId = params.id as string;

  return <ChatUI chatId={chatId} />;
}
