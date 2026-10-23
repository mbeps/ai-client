"use client";

import { Bot } from "lucide-react";

/**
 * A small header bar indicating which AI assistant the user is chatting with.
 * Renders nothing when no assistant is associated with the chat.
 *
 * @param assistantName - The display name of the current assistant, if any.
 */
export function AssistantBar({ assistantName }: { assistantName?: string }) {
  if (!assistantName) return null;

  return (
    <div className="bg-muted/30 text-muted-foreground flex items-center gap-2 border-b px-4 py-2 text-sm">
      <Bot className="h-4 w-4" />
      <span>
        Chatting with <strong>{assistantName}</strong>
      </span>
    </div>
  );
}
