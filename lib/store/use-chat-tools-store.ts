import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ApprovalMode } from "@/types/tool/approval";

/**
 * Key used to store tool selections made on the home page before a chat is created.
 */
export const NEW_CHAT_TOOLS_KEY = "__new__";

export interface ChatToolsState {
  toolsByChat: Record<string, string[]>;
  approvalModeByChat: Record<string, ApprovalMode>;
  setChatTools: (chatId: string, tools: string[]) => void;
  setChatApprovalMode: (chatId: string, mode: ApprovalMode) => void;
  clearChatTools: (chatId: string) => void;
  transferChatTools: (fromChatId: string, toChatId: string) => void;
  clearAll: () => void;
}

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/**
 * Minimal Zustand store persisted to localStorage for storing per-chat tool selections.
 * Allows user-toggled tool preferences to survive page refreshes while falling back to
 * project/assistant/global defaults when uncustomized.
 *
 * @author Maruf Bepary
 */
export const useChatToolsStore = create<ChatToolsState>()(
  persist(
    (set) => ({
      toolsByChat: {},
      approvalModeByChat: {},

      setChatTools: (chatId, tools) => {
        set((state) => ({
          toolsByChat: {
            ...state.toolsByChat,
            [chatId]: tools,
          },
        }));
      },

      setChatApprovalMode: (chatId, mode) => {
        set((state) => ({
          approvalModeByChat: {
            ...state.approvalModeByChat,
            [chatId]: mode,
          },
        }));
      },

      clearChatTools: (chatId) => {
        set((state) => {
          const hasTools = chatId in state.toolsByChat;
          const hasMode = chatId in state.approvalModeByChat;
          if (!hasTools && !hasMode) return state;
          const { [chatId]: _tools, ...restTools } = state.toolsByChat;
          const { [chatId]: _mode, ...restModes } = state.approvalModeByChat;
          return {
            toolsByChat: restTools,
            approvalModeByChat: restModes,
          };
        });
      },

      transferChatTools: (fromChatId, toChatId) => {
        set((state) => {
          const fromTools = state.toolsByChat[fromChatId];
          const fromMode = state.approvalModeByChat[fromChatId];
          if (fromTools === undefined && fromMode === undefined) return state;

          const { [fromChatId]: _tools, ...restTools } = state.toolsByChat;
          const { [fromChatId]: _mode, ...restModes } =
            state.approvalModeByChat;
          return {
            toolsByChat:
              fromTools !== undefined
                ? { ...restTools, [toChatId]: fromTools }
                : restTools,
            approvalModeByChat:
              fromMode !== undefined
                ? { ...restModes, [toChatId]: fromMode }
                : restModes,
          };
        });
      },

      clearAll: () => {
        set({ toolsByChat: {}, approvalModeByChat: {} });
      },
    }),
    {
      name: "chat-tool-selections",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
    },
  ),
);
