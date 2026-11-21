"use client";

import { Search } from "lucide-react";
import { ChatCard } from "@/components/chat/chat-card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import type { Chat } from "@/types/chat/chat";

/**
 * Props for the EntityChatsTab component.
 */
export interface EntityChatsTabProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filteredChats: Chat[];
  emptyMessage: string;
}

/**
 * Shared chats tab for an Agent or Project: search filter, grid of chat cards, and empty state.
 */
export function EntityChatsTab({
  searchQuery,
  onSearchQueryChange,
  filteredChats,
  emptyMessage,
}: EntityChatsTabProps) {
  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-xs">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
        <Input
          placeholder="Search chats..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredChats.map((chat) => (
          <ChatCard key={chat.id} chat={chat} />
        ))}
        {filteredChats.length === 0 && (
          <EmptyState
            message={searchQuery ? "No chats match your search." : emptyMessage}
          />
        )}
      </div>
    </div>
  );
}
