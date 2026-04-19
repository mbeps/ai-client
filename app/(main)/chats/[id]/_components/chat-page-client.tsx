"use client";

import { useEffect, useRef } from "react";
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
  const didSendInitial = useRef(false);

  useEffect(() => {
    upsertChat(initialChat);
  }, [initialChat, upsertChat]);

  return (
    <ChatUI
      chatId={initialChat.id}
      initialMessage={!didSendInitial.current ? initialMessage : undefined}
      onInitialMessageSent={() => {
        didSendInitial.current = true;
      }}
    />
  );
}
