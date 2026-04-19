"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiGetChat } from "@/lib/chat/api";
import type { ChatWithMessages } from "@/lib/chat/api";
import { useAppStore } from "@/lib/store";
import type { Chat, Message } from "@/lib/store";
import { ChatUI } from "@/components/chat/chat-ui";
import { Skeleton } from "@/components/ui/skeleton";

function buildChatFromRows(row: ChatWithMessages): Chat {
  const messages: Record<string, Message> = {};

  for (const m of row.messages) {
    messages[m.id] = {
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: new Date(m.createdAt),
      parentId: m.parentId,
      childrenIds: [],
    };
  }

  for (const m of row.messages) {
    if (m.parentId && messages[m.parentId]) {
      messages[m.parentId].childrenIds.push(m.id);
    }
  }

  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    updatedAt: new Date(row.updatedAt),
    messages,
    currentLeafId: row.currentLeafId,
  };
}

/**
 * Single chat view page that renders ChatUI for the chat matching the URL parameter.
 * Fetches the chat and its messages from the DB on mount, hydrates Zustand, then renders.
 * Route: /chats/[id].
 *
 * @author Maruf Bepary
 */
export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const chatId = params.id as string;
  const upsertChat = useAppStore((state) => state.upsertChat);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const initialMessage = searchParams.get("msg") ?? undefined;
  const didSendInitial = useRef(false);

  useEffect(() => {
    apiGetChat(chatId)
      .then((data) => {
        const chat = buildChatFromRows(data);
        upsertChat(chat);
      })
      .catch(() => {
        setNotFound(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [chatId, upsertChat]);

  if (isLoading)
    return (
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  if (notFound)
    return (
      <div className="flex-1 p-6 text-muted-foreground">Chat not found.</div>
    );

  return (
    <ChatUI
      chatId={chatId}
      initialMessage={!didSendInitial.current ? initialMessage : undefined}
      onInitialMessageSent={() => {
        didSendInitial.current = true;
      }}
    />
  );
}
