import { useCallback, useEffect, useMemo, useRef } from "react";
import { resolveInitialChatConfig } from "@/components/chat/use-chat-initial-state";
import { scrollElementToBottom } from "@/components/chat/use-chat-message-actions";
import { reconstructThread } from "@/lib/chat/reconstruct-thread";
import type { Assistant } from "@/types/assistant/assistant";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import type { Project } from "@/types/project/project";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

/**
 * Checks should show reopen.
 *
 * @param isArtifactOpen - Target is artifact open
 * @param artifactsLength - Target artifacts length
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function checkShouldShowReopen(
  isArtifactOpen: boolean,
  artifactsLength: number,
): boolean {
  return !isArtifactOpen && artifactsLength > 0;
}

/**
 * Updates chat knowledgebase.
 *
 * @param chatId - Chat session identifier
 * @param kbIds - Target kb ids
 * @param setKnowledgebaseDb - Target set knowledgebase db
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function updateChatKnowledgebase(
  chatId: string,
  kbIds: string[],
  setKnowledgebaseDb: (chatId: string, kbId: string | null) => void,
): void {
  setKnowledgebaseDb(chatId, kbIds[0] ?? null);
}

/**
 * Checks can mention assistant.
 *
 * @param threadLength - Target thread length
 * @param assistantId - Target assistant id
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function checkCanMentionAssistant(
  threadLength: number,
  assistantId?: string | null,
): boolean {
  return threadLength === 0 && !assistantId;
}

/**
 * Filters enabled mcp servers.
 *
 * @param servers - Target servers
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function filterEnabledMcpServers<T extends { enabled: boolean }>(
  servers: T[],
): T[] {
  return servers.filter((s) => s.enabled);
}

/**
 * Custom hook that provides use chat initial selections functionality.
 *
 * @param thread - Array of chat messages in the conversation
 * @param currentProject - Target current project
 * @param currentAssistant - Target current assistant
 * @param userSettings - Target user settings
 * @param chat - Target chat
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useChatInitialSelections(
  thread: Message[],
  currentProject: Project | undefined,
  currentAssistant: Assistant | undefined,
  userSettings: UserSettingsRow | null,
  chat: Chat | undefined,
) {
  return useMemo(
    () =>
      resolveInitialChatConfig(
        thread,
        currentProject,
        currentAssistant,
        userSettings,
        chat,
      ),
    [thread, currentProject, currentAssistant, userSettings, chat],
  );
}

/**
 * Resolves thread.
 *
 * @param messages - Target messages
 * @param currentLeafId - Target current leaf id
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function resolveThread(
  messages: Record<string, Message> | undefined,
  currentLeafId: string | null | undefined,
): Message[] {
  if (!messages || !currentLeafId) return [];
  return reconstructThread(messages, currentLeafId);
}

/**
 * Custom hook that provides use chat scroll to bottom functionality.
 *
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useChatScrollToBottom() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    scrollElementToBottom(scrollRef.current);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return scrollRef;
}
