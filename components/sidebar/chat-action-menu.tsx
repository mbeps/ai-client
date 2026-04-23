"use client";

import * as React from "react";
import { SidebarMenuAction } from "@/components/ui/sidebar";
import { MoreHorizontal } from "lucide-react";
import { ChatOptions } from "@/components/chat/chat-options";
import type { Chat } from "@/types/chat";

/**
 * Internal action menu for a sidebar chat item.
 * Reuses the global ChatOptions component to provide Rename, Move, and Delete actions.
 *
 * @param props.chat - The chat object.
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
