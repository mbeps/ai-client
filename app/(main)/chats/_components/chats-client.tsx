"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatCard } from "@/components/chat/chat-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { useCreateChat } from "@/hooks/use-create-chat";
import type { Chat } from "@/lib/store";

interface ChatsClientProps {
  initialChats: Chat[];
}

/**
 * Client-side component for the chat list page.
 * Manages search, filtering, and optimistic updates via the Zustand store.
 * Uses the shared ResourceListPage for a consistent layout.
 *
 * @param props.initialChats - The list of chats from the server.
 * @author Maruf Bepary
 */
export function ChatsClient({ initialChats }: ChatsClientProps) {
  const { chats: storeChats, upsertChat } = useAppStore();
  const createNewChat = useCreateChat();
  const [filter, setFilter] = useState("all");

  // Sync initial server data into the store on mount
  useEffect(() => {
    initialChats.forEach((chat) => upsertChat(chat));
  }, [initialChats, upsertChat]);

  const allChats = Object.values(storeChats);

  const customFilterFn = (chat: Chat) => {
    if (filter === "project" && !chat.projectId) return false;
    if (filter === "assistant" && !chat.assistantId) return false;
    if (filter === "none" && (chat.projectId || chat.assistantId)) return false;
    return true;
  };

  return (
    <ResourceListPage
      icon={<MessageSquare className="h-8 w-8 text-primary" />}
      title="Chats"
      description="Your conversation history."
      items={allChats}
      renderCard={(chat) => <ChatCard chat={chat} />}
      emptyStateMessage="No chats yet. Start a new conversation from the home page."
      searchPlaceholder="Search chats..."
      action={
        <Button onClick={() => createNewChat()} className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      }
      filterFn={(chat, query) =>
        chat.title.toLowerCase().includes(query.toLowerCase())
      }
      customFilterFn={customFilterFn}
      extraFilters={
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chats</SelectItem>
            <SelectItem value="project">In Projects</SelectItem>
            <SelectItem value="assistant">With Assistants</SelectItem>
            <SelectItem value="none">Standalone</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  );
}
