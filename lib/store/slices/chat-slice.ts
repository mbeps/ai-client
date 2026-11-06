import type { StateCreator } from "zustand";
import { createChat } from "@/actions/chats/create-chat";
import { deleteChat } from "@/actions/chats/delete-chat";
import { deleteMessage as deleteMessageAction } from "@/actions/chats/delete-message";
import { moveChat as moveChatAction } from "@/actions/chats/move-chat";
import { renameChat as renameChatAction } from "@/actions/chats/rename-chat";
import { updateChatKnowledgebase } from "@/actions/chats/update-chat-knowledgebase";
import { updateCurrentLeaf as updateCurrentLeafAction } from "@/actions/chats/update-current-leaf";
import { updateMessageMetadata as updateMessageMetadataAction } from "@/actions/chats/update-message-metadata";
import { buildChatAfterSubtreeRemoval } from "@/lib/store/slices/chat/build-chat-after-subtree-removal";
import { buildChatWithCurrentLeaf } from "@/lib/store/slices/chat/build-chat-with-current-leaf";
import { buildChatWithInsertedMessage } from "@/lib/store/slices/chat/build-chat-with-inserted-message";
import { buildChatWithKnowledgebase } from "@/lib/store/slices/chat/build-chat-with-knowledgebase";
import { buildChatWithMessageMetadata } from "@/lib/store/slices/chat/build-chat-with-message-metadata";
import { buildChatWithMovedProject } from "@/lib/store/slices/chat/build-chat-with-moved-project";
import { buildChatWithRenamedTitle } from "@/lib/store/slices/chat/build-chat-with-renamed-title";
import { buildChatWithUpdatedAttachments } from "@/lib/store/slices/chat/build-chat-with-updated-attachments";
import { buildNewChatFromRow } from "@/lib/store/slices/chat/build-new-chat-from-row";
import { createChatRollbackState } from "@/lib/store/slices/chat/create-chat-rollback-state";
import { groupMessagesByChatId } from "@/lib/store/slices/chat/group-messages-by-chat-id";
import { initializeChatsFromRows } from "@/lib/store/slices/chat/initialize-chats-from-rows";
import { mergeUpsertedChat } from "@/lib/store/slices/chat/merge-upserted-chat";
import { populateMessagesAndTree } from "@/lib/store/slices/chat/populate-messages-and-tree";
import type { AppState } from "@/types/app/app-state";

/**
 * Type representing the chat-specific slice of the global Zustand store.
 * Includes all chat management actions (create, delete, update messages, etc.)
 * and database persistence methods.
 *
 * @see createChatSlice for the implementation
 */
type ChatSlice = Pick<
  AppState,
  | "chats"
  | "addMessage"
  | "deleteMessage"
  | "deleteMessageDb"
  | "updateMessageAttachments"
  | "updateMessageMetadataDb"
  | "loadChats"
  | "upsertChat"
  | "renameChatDb"
  | "moveChatDb"
  | "createChatDb"
  | "deleteChatDb"
  | "setKnowledgebaseDb"
  | "setCurrentLeafDb"
  | "resetChatState"
>;

/**
 * Creates the chat slice of the Zustand store. Manages in-memory chat state, message trees, and branching conversations.
 * Implements optimistic UI patterns with database sync via server actions.
 *
 * Implementation details:
 * - Messages form a tree with parentId and childrenIds for branching
 * - currentLeafId tracks the active message branch for rendering
 * - Recursive deletion handles entire subtrees (message + all descendants)
 * - Pure state-transition builders are delegated to individual helpers in lib/store/slices/chat/
 *
 * @param set - Zustand set function
 * @param get - Zustand get function
 * @returns Initialized ChatSlice
 * @author Maruf Bepary
 */
export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (
  set,
  get,
) => ({
  chats: {},

  addMessage: (chatId, params) => {
    const newMessageId = params.id ?? crypto.randomUUID();
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;

      return {
        chats: {
          ...state.chats,
          [chatId]: buildChatWithInsertedMessage(chat, params, newMessageId),
        },
      };
    });
  },

  deleteMessage: (chatId, messageId) => {
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;

      const { updatedChat } = buildChatAfterSubtreeRemoval(chat, messageId);

      return {
        chats: {
          ...state.chats,
          [chatId]: updatedChat,
        },
      };
    });
  },

  deleteMessageDb: async (chatId, messageId) => {
    const chat = get().chats[chatId];
    if (!chat) return;

    const { newLeafId } = buildChatAfterSubtreeRemoval(chat, messageId);

    const previousChat = get().chats[chatId];
    get().deleteMessage(chatId, messageId);
    try {
      await deleteMessageAction(chatId, messageId, newLeafId);
    } catch (error) {
      set((state) => ({
        chats: createChatRollbackState(state.chats, chatId, previousChat),
      }));
      throw error;
    }
  },

  setCurrentLeafDb: async (chatId, leafId) => {
    const previousChat = get().chats[chatId];
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;
      return {
        chats: {
          ...state.chats,
          [chatId]: buildChatWithCurrentLeaf(chat, leafId),
        },
      };
    });
    try {
      await updateCurrentLeafAction(chatId, leafId);
    } catch {
      set((state) => ({
        chats: createChatRollbackState(state.chats, chatId, previousChat),
      }));
    }
  },

  updateMessageAttachments: (chatId, messageId, attachments) => {
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;
      const updatedChat = buildChatWithUpdatedAttachments(
        chat,
        messageId,
        attachments,
      );
      if (!updatedChat) return state;
      return {
        chats: {
          ...state.chats,
          [chatId]: updatedChat,
        },
      };
    });
  },

  updateMessageMetadataDb: async (chatId, messageId, metadata) => {
    const previousChat = get().chats[chatId];
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;
      const updatedChat = buildChatWithMessageMetadata(
        chat,
        messageId,
        metadata,
      );
      if (!updatedChat) return state;
      return {
        chats: {
          ...state.chats,
          [chatId]: updatedChat,
        },
      };
    });
    try {
      await updateMessageMetadataAction(messageId, metadata);
    } catch {
      set((state) => ({
        chats: createChatRollbackState(state.chats, chatId, previousChat),
      }));
    }
  },

  loadChats: (rows, messageRows, attachmentRows) => {
    const existingChats = get().chats;
    const messageRowsByChatId = groupMessagesByChatId(messageRows);
    const chats = initializeChatsFromRows(
      rows,
      existingChats,
      messageRowsByChatId,
    );

    if (messageRows.length === 0) {
      set({ chats });
      return;
    }

    populateMessagesAndTree(chats, messageRows, attachmentRows);
    set({ chats });
  },

  upsertChat: (chat) => {
    set((state) => ({
      chats: {
        ...state.chats,
        [chat.id]: mergeUpsertedChat(state.chats[chat.id], chat),
      },
    }));
  },

  renameChatDb: async (id, title) => {
    const previousChat = get().chats[id];
    set((state) => {
      const chat = state.chats[id];
      if (!chat) return state;
      return {
        chats: {
          ...state.chats,
          [id]: buildChatWithRenamedTitle(chat, title),
        },
      };
    });
    try {
      const res = await renameChatAction(id, title);
      if (res?.ok === false) {
        set((state) => ({
          chats: createChatRollbackState(state.chats, id, previousChat),
        }));
      }
    } catch {
      set((state) => ({
        chats: createChatRollbackState(state.chats, id, previousChat),
      }));
    }
  },

  moveChatDb: async (id, projectId) => {
    const previousChat = get().chats[id];
    set((state) => {
      const chat = state.chats[id];
      if (!chat) return state;
      return {
        chats: {
          ...state.chats,
          [id]: buildChatWithMovedProject(chat, projectId),
        },
      };
    });
    try {
      const res = await moveChatAction(id, projectId);
      if (res?.ok === false) {
        set((state) => ({
          chats: createChatRollbackState(state.chats, id, previousChat),
        }));
      }
    } catch {
      set((state) => ({
        chats: createChatRollbackState(state.chats, id, previousChat),
      }));
    }
  },

  createChatDb: async (title, projectId, assistantId) => {
    const res = await createChat(title, projectId, assistantId);
    const row =
      res && typeof res === "object" && "ok" in res
        ? res.ok
          ? res.value
          : null
        : (res as any);
    if (!row) {
      throw new Error((res as any)?.error?.message ?? "Failed to create chat");
    }
    const newChat = buildNewChatFromRow(row);
    set((state) => ({ chats: { ...state.chats, [row.id]: newChat } }));
    return row.id;
  },

  deleteChatDb: async (chatId) => {
    const previousChat = get().chats[chatId];
    set((state) => {
      const { [chatId]: removed, ...rest } = state.chats;
      return { chats: rest };
    });
    try {
      const res = await deleteChat(chatId);
      if (res?.ok === false) {
        set((state) => ({
          chats: createChatRollbackState(state.chats, chatId, previousChat),
        }));
      }
    } catch {
      set((state) => ({
        chats: createChatRollbackState(state.chats, chatId, previousChat),
      }));
    }
  },

  setKnowledgebaseDb: async (chatId, kbId) => {
    const previousChat = get().chats[chatId];
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;
      return {
        chats: {
          ...state.chats,
          [chatId]: buildChatWithKnowledgebase(chat, kbId),
        },
      };
    });
    try {
      const res = await updateChatKnowledgebase({
        chatId,
        knowledgebaseId: kbId,
      });
      if (res?.ok === false) {
        set((state) => ({
          chats: createChatRollbackState(state.chats, chatId, previousChat),
        }));
      }
    } catch {
      set((state) => ({
        chats: createChatRollbackState(state.chats, chatId, previousChat),
      }));
    }
  },

  resetChatState: () => {
    set({ chats: {} });
  },
});
