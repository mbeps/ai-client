"use client";

import { Card } from "@/components/ui/card";
import { Bot } from "lucide-react";
import type { Assistant } from "@/types/assistant";
import { useCreateChat } from "@/hooks/use-create-chat";
import { AssistantOptions } from "./assistant-options";

/**
 * Props for the AssistantCard component.
 *
 * @author Maruf Bepary
 */
interface AssistantCardProps {
  /** The assistant entity to display with name and description. */
  assistant: Assistant;
}

/**
 * Card displaying assistant name, description, and bot icon for assistants listing page.
 * Clicking the card creates a new chat with the assistant context.
 * Options menu in top-right corner (via AssistantOptions) provides Rename and Delete actions.
 *
 * @param props.assistant - Assistant entity containing id, name, description, and avatar.
 * @see AssistantOptions for menu actions.
 * @see useCreateChat for chat creation on card click.
 * @author Maruf Bepary
 */
export function AssistantCard({ assistant }: AssistantCardProps) {
  const createNewChat = useCreateChat();

  return (
    <Card
      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group flex flex-col justify-between min-h-[100px]"
      onClick={() => createNewChat("New Chat", undefined, assistant.id)}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <h3 className="font-semibold leading-none truncate">
              {assistant.name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {assistant.description}
            </p>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <AssistantOptions assistant={assistant} />
        </div>
      </div>
    </Card>
  );
}
