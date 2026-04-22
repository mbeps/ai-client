"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { ROUTES } from "@/lib/routes";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { ChatCard } from "@/components/chat/chat-card";
import { EmptyState } from "@/components/empty-state";
import type { Chat } from "@/lib/store";

interface ChatsClientProps {
  initialChats: Chat[];
}

/**
 * Client-side component for the chat list page.
 * Manages search, filtering, and optimistic updates via the Zustand store.
 *
 * @param props.initialChats - The list of chats from the server.
 * @author Maruf Bepary
 */
export function ChatsClient({ initialChats }: ChatsClientProps) {
  const router = useRouter();
  const { chats: storeChats, upsertChat, createChatDb } = useAppStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // Sync initial server data into the store on mount
  useEffect(() => {
    initialChats.forEach((chat) => upsertChat(chat));
  }, [initialChats, upsertChat]);

  const allChats = Object.values(storeChats);
  const handleNewChat = async () => {
    const id = await createChatDb("New Chat");
    router.push(ROUTES.CHATS.detail(id));
  };

  const filtered = allChats.filter((chat) => {
    if (search && !chat.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (filter === "project" && !chat.projectId) return false;
    if (filter === "assistant" && !chat.assistantId) return false;
    if (filter === "none" && (chat.projectId || chat.assistantId)) return false;
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return (
    <div className="page-container space-y-6">
      <PageHeader
        icon={<MessageSquare className="h-8 w-8 text-primary" />}
        title="Chats"
        description="Your conversation history."
        action={
          <Button onClick={handleNewChat}>
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <Input
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.length === 0 ? (
          <EmptyState message="No chats yet. Start a new conversation from the home page." />
        ) : (
          sorted.map((chat) => (
            <ChatCard
              key={chat.id}
              chat={chat}
            />
          ))
        )}
      </div>
    </div>
  );
}
