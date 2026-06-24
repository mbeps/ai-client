"use client";

import { useMemo } from "react";
import { parseMessageMetadata } from "@/lib/store/mappers/message-mapper";
import type { Message } from "@/types/message/message";
import type { Assistant } from "@/types/assistant/assistant";
import type { Project } from "@/types/project/project";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

/**
 * Resolves the initial AI model ID for a chat session.
 *
 * Priority order:
 * 1. Last user message's stored modelId (existing chat, metadata persistence)
 * 2. Project default model (new chat, schema expansion)
 * 3. Assistant default model (new chat, schema expansion)
 * 4. User settings global default model
 *
 * @param thread - The reconstructed message thread for the active branch.
 * @param project - The associated project (if any).
 * @param assistant - The associated assistant (if any).
 * @param userSettings - The current user's application settings.
 * @returns The resolved model ID, or undefined if no preference is set.
 */
export function useInitialModel(
  thread: Message[],
  project: Project | null,
  assistant: Assistant | null,
  userSettings: UserSettingsRow | null,
): string | undefined {
  return useMemo(() => {
    // 1. Existing chat: get model from the last user message
    const lastUserMessage = [...thread]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMessage?.metadata) {
      const { modelId } = parseMessageMetadata(lastUserMessage.metadata);
      if (modelId) return modelId;
    }

    // 2. New chat: prioritize Project > Assistant > User Settings
    if ((project as any)?.defaultChatModelId) {
      return (project as any).defaultChatModelId;
    }
    if ((assistant as any)?.defaultChatModelId) {
      return (assistant as any).defaultChatModelId;
    }

    // 3. Application-wide default
    return userSettings?.defaultChatModelId || undefined;
  }, [thread, project, assistant, userSettings]);
}
