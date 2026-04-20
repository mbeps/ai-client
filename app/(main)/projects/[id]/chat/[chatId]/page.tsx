"use client";

import { ChatUI } from "@/components/chat/chat-ui";
import { useParams } from "next/navigation";

export default function ProjectChatPage() {
  const params = useParams();
  const chatId = params.chatId as string;

  return <ChatUI chatId={chatId} />;
}
