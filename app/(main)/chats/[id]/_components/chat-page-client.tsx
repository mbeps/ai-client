"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/types/chat/chat";
import { ChatUI } from "@/components/chat/chat-ui";

interface ChatPageClientProps {
  initialChat: Chat;
  initialMessage?: string;
}

/**
 * Chat page client: Hydrate chat state and render streaming UI.
 *
 * Wrapper component that syncs server-fetched chat to Zustand store and renders
 * full chat interface (ChatUI). Handles optional initial message pre-population for
 * sharing chat state via URL search params. Manages hasSentInitial flag to prevent
 * duplicate auto-send on re-renders.
 *
 * @author Maruf Bepary
 */
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
