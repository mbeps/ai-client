"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/types/chat";
import { ChatUI } from "@/components/chat/chat-ui";

/**
 * Props for the ChatPageClient component.
 * Bridges server-rendered chat data with client-side Zustand store hydration.
 */
interface ChatPageClientProps {
  /** Pre-fetched chat data from server with full message tree. */
  initialChat: Chat;

  /** Optional message to send immediately after hydration. */
  initialMessage?: string;
}

/**
 * Client-side hydration wrapper for chat pages.
 * Persists the server-provided chat to Zustand store and renders ChatUI,
 * enabling reactive updates and SSR-compatible initialization.
 * Use this as the root of any chat page server component to bridge
 * server data with client-side state management.
 *
 * @param props - Server-rendered chat data and optional initial message.
 * @returns ChatUI wrapped with store hydration and initial message tracking.
 * @see ChatUI for the main chat interface.
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
