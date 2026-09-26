"use client";

import { useEffect, useState } from "react";
import { ChatUI } from "@/components/chat/chat-ui";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/types/chat/chat";

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
 */
export function ChatPageClient({
  initialChat,
  initialMessage,
}: ChatPageClientProps) {
  const upsertChat = useAppStore((state) => state.upsertChat);
  const hasExistingMessages = Object.keys(initialChat.messages).length > 0;
  const [hasSentInitial, setHasSentInitial] = useState(hasExistingMessages);

  useEffect(() => {
    upsertChat(initialChat);
    if (initialMessage && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("msg")) {
        url.searchParams.delete("msg");
        window.history.replaceState(
          {},
          "",
          url.pathname + (url.search ? url.search : ""),
        );
      }
    }
  }, [initialChat, upsertChat, initialMessage]);

  return (
    <ChatUI
      chatId={initialChat.id}
      initialChat={initialChat}
      initialMessage={!hasSentInitial ? initialMessage : undefined}
      onInitialMessageSent={() => {
        setHasSentInitial(true);
      }}
    />
  );
}
