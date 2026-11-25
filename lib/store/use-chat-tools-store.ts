import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { Attachment } from "@/types/attachment/attachment";
import type { ApprovalMode } from "@/types/tool/approval";

/**
 * Key used to store tool selections made on the home page before a chat is created.
 */
export const NEW_CHAT_TOOLS_KEY = "__new__";

/**
 * Ephemeral launch payload captured on the home page and consumed once by ChatUI
 * after redirecting to `/chats/[id]`, preserving all composer selections and attachments.
 */
export interface PendingChatLaunch {
  content: string;
  attachments: Attachment[];
  model: string;
  selectedServerIds: string[];
  selectedTools: string[];
  selectedPromptId?: string | string[];
  selectedAssistantId?: string;
  selectedKnowledgebases?: string[];
  selectedSkillIds?: string[];
  subagentsEnabled?: boolean;
  subagentModelId?: string;
  reasoningEffort?: ReasoningEffort;
  subagentIds?: string[];
  approvalMode?: ApprovalMode;
}

export interface ChatToolsState {
  toolsByChat: Record<string, string[]>;
  approvalModeByChat: Record<string, ApprovalMode>;
  pendingLaunchByChat: Record<string, PendingChatLaunch>;
  setChatTools: (chatId: string, tools: string[]) => void;
  setChatApprovalMode: (chatId: string, mode: ApprovalMode) => void;
  setPendingLaunch: (chatId: string, launch: PendingChatLaunch) => void;
  clearPendingLaunch: (chatId: string) => void;
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
 * Minimal Zustand store persisted to localStorage for storing per-chat tool selections,
 * plus an in-memory map for pending home-page chat launches.
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
      pendingLaunchByChat: {},

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

      setPendingLaunch: (chatId, launch) => {
        set((state) => ({
          pendingLaunchByChat: {
            ...state.pendingLaunchByChat,
            [chatId]: launch,
          },
        }));
      },

      clearPendingLaunch: (chatId) => {
        set((state) => {
          if (!(chatId in state.pendingLaunchByChat)) return state;
          const { [chatId]: _launch, ...rest } = state.pendingLaunchByChat;
          return { pendingLaunchByChat: rest };
        });
      },

      clearChatTools: (chatId) => {
        set((state) => {
          const hasTools = chatId in state.toolsByChat;
          const hasMode = chatId in state.approvalModeByChat;
          const hasLaunch = chatId in state.pendingLaunchByChat;
          if (!hasTools && !hasMode && !hasLaunch) return state;
          const { [chatId]: _tools, ...restTools } = state.toolsByChat;
          const { [chatId]: _mode, ...restModes } = state.approvalModeByChat;
          const { [chatId]: _launch, ...restLaunches } =
            state.pendingLaunchByChat;
          return {
            toolsByChat: restTools,
            approvalModeByChat: restModes,
            pendingLaunchByChat: restLaunches,
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
        set({
          toolsByChat: {},
          approvalModeByChat: {},
          pendingLaunchByChat: {},
        });
      },
    }),
    {
      name: "chat-tool-selections",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      partialize: (state) => ({
        toolsByChat: state.toolsByChat,
        approvalModeByChat: state.approvalModeByChat,
      }),
    },
  ),
);
