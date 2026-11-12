import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Key used to store tool selections made on the home page before a chat is created.
 */
export const NEW_CHAT_TOOLS_KEY = "__new__";

export interface ChatToolsState {
  toolsByChat: Record<string, string[]>;
  setChatTools: (chatId: string, tools: string[]) => void;
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

      setChatTools: (chatId, tools) => {
        set((state) => ({
          toolsByChat: {
            ...state.toolsByChat,
            [chatId]: tools,
          },
        }));
      },

      clearChatTools: (chatId) => {
        set((state) => {
          if (!(chatId in state.toolsByChat)) return state;
          const { [chatId]: _, ...rest } = state.toolsByChat;
          return { toolsByChat: rest };
        });
      },

      transferChatTools: (fromChatId, toChatId) => {
        set((state) => {
          const fromTools = state.toolsByChat[fromChatId];
          if (fromTools === undefined) return state;
          const { [fromChatId]: _, ...rest } = state.toolsByChat;
          return {
            toolsByChat: {
              ...rest,
              [toChatId]: fromTools,
            },
          };
        });
      },

      clearAll: () => {
        set({ toolsByChat: {} });
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
