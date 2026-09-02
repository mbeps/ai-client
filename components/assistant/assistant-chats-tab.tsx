"use client";

import { Search } from "lucide-react";
import { ChatCard } from "@/components/chat/chat-card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import type { Chat } from "@/types/chat/chat";

export interface AssistantChatsTabProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filteredChats: Chat[];
}

/**
 * Chats tab for an Assistant: search filter, grid of chat cards, and empty state.
 *
 * @author Maruf Bepary
 */
export function AssistantChatsTab({
  searchQuery,
  onSearchQueryChange,
  filteredChats,
}: AssistantChatsTabProps) {
  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
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
            message={
              searchQuery
                ? "No chats match your search."
                : "No chats with this assistant yet."
            }
          />
        )}
      </div>
    </div>
  );
}
export default AssistantChatsTab;
