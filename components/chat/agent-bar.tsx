"use client";

import { Bot } from "lucide-react";

/**
 * A small header bar indicating which AI Agent the user is chatting with.
 * Renders nothing when no agent is associated with the chat.
 *
 * @param agentName - The display name of the current agent, if any.
 */
export function AgentBar({ agentName }: { agentName?: string }) {
  if (!agentName) return null;

  return (
    <div className="bg-muted/30 text-muted-foreground flex items-center gap-2 border-b px-4 py-2 text-sm">
      <Bot className="h-4 w-4" />
      <span>
        Chatting with <strong>{agentName}</strong>
      </span>
    </div>
  );
}
