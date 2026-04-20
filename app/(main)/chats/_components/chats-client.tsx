"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ChatCard } from "@/components/chat/chat-card";
import { EmptyState } from "@/components/empty-state";
import { deleteChat } from "@/lib/actions/chats/delete-chat";
import type { Chat } from "@/lib/store";

interface ChatsClientProps {
  initialChats: Chat[];
}

export function ChatsClient({ initialChats }: ChatsClientProps) {
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = chats.filter((chat) => {
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

  const handleDelete = async (chatId: string) => {
    try {
      await deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
    } catch {
      // silently ignore deletion errors
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        icon={<MessageSquare className="h-8 w-8 text-primary" />}
        title="All Chats"
        description="Manage all your conversations."
      />
      <div className="flex gap-4 max-w-xl mb-6">
        <Input
          placeholder="Search chats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
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
              onDelete={() => handleDelete(chat.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
