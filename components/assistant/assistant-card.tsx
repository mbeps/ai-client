"use client";

import { Bot } from "lucide-react";
import type { Assistant } from "@/types/assistant/assistant";
import { useCreateChat } from "@/hooks/chat/use-create-chat";
import { AssistantOptions } from "./assistant-options";
import { EntityCard } from "@/components/shared/entity-card";

/**
 * Props for the AssistantCard component.
 *
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
 */
export function AssistantCard({ assistant }: AssistantCardProps) {
  const createNewChat = useCreateChat();

  return (
    <EntityCard
      icon={<Bot className="h-5 w-5 text-primary" />}
      title={assistant.name}
      description={assistant.description}
      menu={<AssistantOptions assistant={assistant} />}
      onClick={() => createNewChat("New Chat", undefined, assistant.id)}
    />
  );
}
