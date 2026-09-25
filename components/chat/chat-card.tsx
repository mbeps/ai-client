"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import type { Chat } from "@/types/chat/chat";
import { ChatOptions } from "./chat-options";

/**
 * Props for the ChatCard component.
 *
 */
interface ChatCardProps {
  /** The chat entity to display. */
  chat: Chat;
}

/**
 * Card representing a single chat in the chats listing page.
 * Navigates to the chat's URL on click (project-scoped or standalone).
 * Shows a chat type label and an options menu with Move and Delete actions.
 *
 * @param props.chat - The chat to display.
 */
export function ChatCard({ chat }: ChatCardProps) {
  const targetHref = chat.projectId
    ? ROUTES.PROJECTS.chat(chat.projectId, chat.id)
    : chat.assistantId
      ? ROUTES.ASSISTANTS.chat(chat.assistantId, chat.id)
      : ROUTES.CHATS.detail(chat.id);

  return (
    <Link href={targetHref} className="group block h-full focus-visible:outline-none">
      <Card className="flex h-full min-h-[80px] cursor-pointer flex-col justify-between p-4 transition-colors hover:bg-muted/50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="truncate font-semibold leading-none">
                {chat.title}
              </h3>
              <p className="line-clamp-1 text-muted-foreground text-xs">
                {chat.projectId
                  ? "Project Chat"
                  : chat.assistantId
                    ? "Assistant Chat"
                    : "Standalone Chat"}
              </p>
            </div>
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <ChatOptions chat={chat} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
