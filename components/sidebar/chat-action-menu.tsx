"use client";

import * as React from "react";
import { SidebarMenuAction } from "@/components/ui/sidebar";
import { MoreHorizontal } from "lucide-react";
import { ChatOptions } from "@/components/chat/chat-options";
import type { Chat } from "@/types/chat";

/**
 * Action menu for individual chat sidebar items.
 * Displays a three-dot icon that opens a dropdown with Rename, Move (to project), and Delete actions.
 * Visibility is conditional: opaque on hover (lg+) and always visible on mobile.
 *
 * @param props.chat - The chat object with id, title, and optional projectId
 * @see ChatOptions for the underlying menu implementation
 * @author Maruf Bepary
 */
export function ChatActionMenu({ chat }: { chat: Chat }) {
  const trigger = (
    <SidebarMenuAction className="lg:opacity-0 lg:group-hover/menu-item:opacity-100">
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More</span>
    </SidebarMenuAction>
  );

  return <ChatOptions chat={chat} trigger={trigger} />;
}
