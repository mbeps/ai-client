"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ChatCard } from "@/components/chat/chat-card";
import { EmptyState } from "@/components/empty-state";
import type { Chat } from "@/types/chat/chat";

export interface ProjectChatsTabProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filteredChats: Chat[];
}

/**
 * Chats tab for a Project: search filter, grid of chat cards, and empty state.
 *
 * @author Maruf Bepary
 */
export function ProjectChatsTab({
  searchQuery,
  onSearchQueryChange,
  filteredChats,
}: ProjectChatsTabProps) {
  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search chats..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredChats.map((chat) => (
          <ChatCard key={chat.id} chat={chat} />
        ))}
        {filteredChats.length === 0 && (
          <EmptyState
            message={
              searchQuery
                ? "No chats match your search."
                : "No chats in this project yet."
            }
          />
        )}
      </div>
    </div>
  );
}
export default ProjectChatsTab;
