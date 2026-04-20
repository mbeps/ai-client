"use client";

import { Card } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import type { Chat } from "@/lib/store";
import { ChatOptions } from "./chat-options";

/**
 * Props for the ChatCard component.
 *
 * @author Maruf Bepary
 */
interface ChatCardProps {
  /** The chat entity to display. */
  chat: Chat;
  /** Callback invoked when the user confirms deletion. */
  onDelete: () => void;
}

/**
 * Card representing a single chat in the chats listing page.
 * Navigates to the chat's URL on click (project-scoped or standalone).
 * Shows a chat type label and an options menu with Move and Delete actions.
 *
 * @param props.chat - The chat to display.
 * @param props.onDelete - Called when the user deletes the chat.
 * @author Maruf Bepary
 */
export function ChatCard({ chat, onDelete }: ChatCardProps) {
  const router = useRouter();

  return (
    <Card
      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group flex flex-col justify-between min-h-[80px]"
      onClick={() =>
        router.push(
          chat.projectId
            ? ROUTES.PROJECTS.chat(chat.projectId, chat.id)
            : ROUTES.CHATS.detail(chat.id),
        )
      }
    >
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-semibold leading-none truncate">
              {chat.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {chat.projectId
                ? "Project Chat"
                : chat.assistantId
                  ? "Assistant Chat"
                  : "Standalone Chat"}
            </p>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ChatOptions chat={chat} onDelete={onDelete} />
        </div>
      </div>
    </Card>
  );
}
