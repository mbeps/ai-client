"use client";

import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Custom hook that provides use chat store functionality.
 *
 * @param chatId - The chat id parameter.
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useChatStore(chatId: string) {
  const storeChat = useAppStore((state) => state.chats[chatId]);
  const deleteMessageDb = useAppStore((state) => state.deleteMessageDb);
  const setCurrentLeafDb = useAppStore((state) => state.setCurrentLeafDb);
  const setKnowledgebaseDb = useAppStore((state) => state.setKnowledgebaseDb);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);
  const assistants = useAppStore((state) => state.assistants);
  const userSettings = useAppStore((state) => state.userSettings);
  const projects = useAppStore((state) => state.projects);
  const updateMessageMetadataDb = useAppStore(
    (state) => state.updateMessageMetadataDb,
  );
  return {
    storeChat,
    deleteMessageDb,
    setCurrentLeafDb,
    setKnowledgebaseDb,
    mcpServers,
    loadMcpServers,
    assistants,
    userSettings,
    projects,
    updateMessageMetadataDb,
  };
}
