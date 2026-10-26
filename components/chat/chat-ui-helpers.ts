import { useCallback, useEffect, useMemo, useRef } from "react";
import { resolveInitialChatConfig } from "@/components/chat/use-chat-initial-state";
import { scrollElementToBottom } from "@/components/chat/use-chat-message-actions";
import { reconstructThread } from "@/lib/chat/reconstruct-thread";
import type { Assistant } from "@/types/assistant/assistant";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import type { Project } from "@/types/project/project";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

export function checkShouldShowReopen(
  isArtifactOpen: boolean,
  artifactsLength: number,
): boolean {
  return !isArtifactOpen && artifactsLength > 0;
}

export function updateChatKnowledgebase(
  chatId: string,
  kbIds: string[],
  setKnowledgebaseDb: (chatId: string, kbId: string | null) => void,
): void {
  setKnowledgebaseDb(chatId, kbIds[0] ?? null);
}

export function checkCanMentionAssistant(
  threadLength: number,
  assistantId?: string | null,
): boolean {
  return threadLength === 0 && !assistantId;
}

export function filterEnabledMcpServers<T extends { enabled: boolean }>(
  servers: T[],
): T[] {
  return servers.filter((s) => s.enabled);
}

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

export function resolveThread(
  messages: Record<string, Message> | undefined,
  currentLeafId: string | null | undefined,
): Message[] {
  if (!messages || !currentLeafId) return [];
  return reconstructThread(messages, currentLeafId);
}

export function useEnsureMcpServersLoaded(
  mcpServers: { length: number },
  loadMcpServers: () => Promise<unknown>,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Load MCP servers once on mount
  useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers().catch(() => {});
    }
  }, []);
}

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
