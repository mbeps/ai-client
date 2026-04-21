"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/lib/store";
import { ChatUI } from "@/components/chat/chat-ui";

interface ChatPageClientProps {
  initialChat: Chat;
  initialMessage?: string;
}

export function ChatPageClient({
  initialChat,
  initialMessage,
}: ChatPageClientProps) {
  const upsertChat = useAppStore((state) => state.upsertChat);
  const [hasSentInitial, setHasSentInitial] = useState(false);

  useEffect(() => {
    upsertChat(initialChat);
  }, [initialChat, upsertChat]);

  return (
    <ChatUI
      chatId={initialChat.id}
      initialMessage={!hasSentInitial ? initialMessage : undefined}
      onInitialMessageSent={() => {
        setHasSentInitial(true);
      }}
    />
  );
}
