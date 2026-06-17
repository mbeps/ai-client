import { StateCreator } from "zustand";
import { getDeepestLeaf } from "@/lib/chat/get-deepest-leaf";
import { insertMessage, removeMessageSubtree } from "@/lib/chat/message-tree";
import { createChat } from "@/lib/actions/chats/create-chat";
import { deleteChat } from "@/lib/actions/chats/delete-chat";
import { renameChat as renameChatAction } from "@/lib/actions/chats/rename-chat";
import { moveChat as moveChatAction } from "@/lib/actions/chats/move-chat";
import { deleteMessage as deleteMessageAction } from "@/lib/actions/chats/delete-message";
import { updateCurrentLeaf as updateCurrentLeafAction } from "@/lib/actions/chats/update-current-leaf";
import { updateMessageMetadata as updateMessageMetadataAction } from "@/lib/actions/chats/update-message-metadata";
import { updateChatKnowledgebase } from "@/lib/actions/chats/update-chat-knowledgebase";
import { messageMetadataSchema } from "@/schemas/chat";
import { chatRowToStore } from "../mappers/chat";
import { withOptimisticUpdate } from "../with-optimistic-update";
import {
  mapMessageFromDb,
  parseMessageMetadata,
} from "../mappers/message-mapper";
import type { AppState } from "@/types/app/app-state";
import type { Message } from "@/types/message/message";
import type { Chat } from "@/types/chat/chat";

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
  | "createChat"
  | "addMessage"
  | "deleteMessage"
  | "deleteMessageDb"
  | "setCurrentLeaf"
  | "setCurrentLeafDb"
  | "deleteChat"
  | "updateMessageAttachments"
  | "updateMessageMetadataDb"
  | "loadChats"
  | "upsertChat"
  | "renameChatDb"
  | "moveChatDb"
  | "createChatDb"
  | "deleteChatDb"
  | "setKnowledgebase"
>;

/**
 * Creates the chat slice of the Zustand store.
 * Manages in-memory chat state, message trees, and branching conversations.
 * Implements optimistic UI patterns with database sync via server actions.
 *
 * Implementation details:
 * - Messages form a tree with parentId and childrenIds for branching
 * - currentLeafId tracks the active message branch for rendering
 * - Recursive deletion handles entire subtrees (message + all descendants)
 * - Tree traversal uses getDeepestLeaf to find terminal nodes
 *
 * @see ChatSlice for the slice type
 * @see Message for message tree structure
 * @author Maruf Bepary
 */
export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (
  set,
  get,
) => ({
  chats: {},

  createChat: (projectId, assistantId) => {
    const newChatId = crypto.randomUUID();
    set((state) => ({
      chats: {
        ...state.chats,
        [newChatId]: {
          id: newChatId,
          title: "New Chat",
          projectId,
          assistantId,
          updatedAt: new Date(),
          messages: {},
          currentLeafId: null,
        },
      },
    }));
    return newChatId;
  },

  addMessage: (
    chatId,
    role,
    content,
    parentId,
    id,
    metadata,
    attachments,
    reasoning,
  ) => {
    const newMessageId = id ?? crypto.randomUUID();
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;

      const newMessage: Message = {
        id: newMessageId,
        role,
        content,
        createdAt: new Date(),
        parentId,
        childrenIds: [],
        metadata: metadata ?? null,
        reasoning: reasoning ?? undefined,
        attachments: attachments ?? [],
      };

      const updatedMessages = insertMessage(chat.messages, newMessage);

      return {
        chats: {
          ...state.chats,
          [chatId]: {
            ...chat,
            messages: updatedMessages,
            currentLeafId: newMessageId,
            updatedAt: new Date(),
          },
        },
      };
    });
  },

  deleteMessage: (chatId, messageId) => {
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;

      const { updatedMessages, parentId: deletedParentId } =
        removeMessageSubtree(chat.messages, messageId);

      let newLeaf = deletedParentId;
      if (newLeaf) {
        newLeaf = getDeepestLeaf(updatedMessages, newLeaf);
      }

      return {
        chats: {
          ...state.chats,
          [chatId]: {
            ...chat,
            messages: updatedMessages,
            currentLeafId: newLeaf,
          },
        },
      };
    });
  },

  deleteMessageDb: async (chatId, messageId) => {
    const chat = get().chats[chatId];
    if (!chat) return;

    const { updatedMessages, parentId: deletedParentId } = removeMessageSubtree(
      chat.messages,
      messageId,
    );
    let newLeafId: string | null = deletedParentId ?? null;
    if (newLeafId) {
      newLeafId = getDeepestLeaf(updatedMessages, newLeafId);
    }

    const previous = get();
    await withOptimisticUpdate(
      () => get().deleteMessage(chatId, messageId),
      () => deleteMessageAction(chatId, messageId, newLeafId),
      () => set(previous),
    );
  },

  setCurrentLeaf: (chatId, leafId) => {
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;
      return {
        chats: {
          ...state.chats,
          [chatId]: {
            ...chat,
            currentLeafId: leafId,
          },
        },
      };
    });
  },

  setCurrentLeafDb: async (chatId, leafId) => {
    const previous = get();
    await withOptimisticUpdate(
      () => get().setCurrentLeaf(chatId, leafId),
      () => updateCurrentLeafAction(chatId, leafId),
      () => set(previous),
      { swallowError: true },
    );
  },

  deleteChat: (chatId) => {
    set((state) => {
      const { [chatId]: removed, ...rest } = state.chats;
      return { chats: rest };
    });
  },

  updateMessageAttachments: (chatId, messageId, attachments) => {
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;
      const msg = chat.messages[messageId];
      if (!msg) return state;
      const updateMap = new Map(attachments.map((a) => [a.id, a]));
      return {
        chats: {
          ...state.chats,
          [chatId]: {
            ...chat,
            messages: {
              ...chat.messages,
              [messageId]: {
                ...msg,
                attachments: (msg.attachments ?? []).map((a) =>
                  updateMap.has(a.id) ? { ...a, ...updateMap.get(a.id)! } : a,
                ),
              },
            },
          },
        },
      };
    });
  },

  updateMessageMetadataDb: async (chatId, messageId, metadata) => {
    const previous = get();
    await withOptimisticUpdate(
      () =>
        set((state) => {
          const chat = state.chats[chatId];
          if (!chat) return state;
          const msg = chat.messages[messageId];
          if (!msg) return state;
          return {
            chats: {
              ...state.chats,
              [chatId]: {
                ...chat,
                messages: {
                  ...chat.messages,
                  [messageId]: { ...msg, metadata },
                },
              },
            },
          };
        }),
      () => updateMessageMetadataAction(messageId, metadata),
      () => set(previous),
      { swallowError: true },
    );
  },

  loadChats: (rows, messageRows, attachmentRows) => {
    const chats: Record<string, Chat> = {};

    for (const row of rows) {
      chats[row.id] = chatRowToStore(row);
    }

    if (messageRows.length === 0) {
      set({ chats });
      return;
    }

    const safeAttachments = attachmentRows ?? [];

    // Pass 1: Create message objects and attach attachments
    for (const m of messageRows) {
      const chatEntry = chats[m.chatId];
      if (!chatEntry) continue;

      const attachmentsForMsg = safeAttachments
        .filter((a) => a.messageId === m.id)
        .map((att) => {
          const isImage = att.mimeType.startsWith("image/");
          return {
            id: att.id,
            type: isImage ? "image" : "document",
            name: att.name,
            mimeType: att.mimeType,
            sizeBytes: att.size,
            dataUrl: "",
            key: att.key,
          };
        });

      chatEntry.messages[m.id] = mapMessageFromDb(
        {
          ...m,
          createdAt: (m as any).createdAt || (m as any).created_at || null,
        } as any,
        attachmentsForMsg as any,
      );
    }

    // Pass 2: Reconstruct tree children
    for (const m of messageRows) {
      if (!(m as any).parentId) continue;
      const chatEntry = chats[(m as any).chatId];
      if (!chatEntry) continue;
      const parent = chatEntry.messages[(m as any).parentId];
      if (parent) parent.childrenIds.push((m as any).id);
    }

    set({ chats });
  },

  upsertChat: (chat) => {
    set((state) => ({
      chats: { ...state.chats, [chat.id]: chat },
    }));
  },

  renameChatDb: async (id, title) => {
    const previous = get();
    await withOptimisticUpdate(
      () =>
        set((state) => {
          const chat = state.chats[id];
          if (!chat) return state;
          return {
            chats: {
              ...state.chats,
              [id]: {
                ...chat,
                title,
                updatedAt: new Date(),
              },
            },
          };
        }),
      () => renameChatAction(id, title),
      () => set(previous),
    );
  },

  moveChatDb: async (id, projectId) => {
    const previous = get();
    await withOptimisticUpdate(
      () =>
        set((state) => {
          const chat = state.chats[id];
          if (!chat) return state;
          return {
            chats: {
              ...state.chats,
              [id]: {
                ...chat,
                projectId,
                updatedAt: new Date(),
              },
            },
          };
        }),
      () => moveChatAction(id, projectId),
      () => set(previous),
    );
  },

  createChatDb: async (title, projectId, assistantId) => {
    const row = await createChat(title, projectId, assistantId);
    const newChat = chatRowToStore(row);
    set((state) => ({ chats: { ...state.chats, [row.id]: newChat } }));
    return row.id;
  },

  deleteChatDb: async (chatId) => {
    const previous = get();
    await withOptimisticUpdate(
      () => get().deleteChat(chatId),
      () => deleteChat(chatId),
      () => set(previous),
    );
  },

  setKnowledgebase: async (chatId, kbId) => {
    const previous = get();
    await withOptimisticUpdate(
      () =>
        set((state) => {
          const chat = state.chats[chatId];
          if (!chat) return state;
          return {
            chats: {
              ...state.chats,
              [chatId]: { ...chat, knowledgebaseId: kbId },
            },
          };
        }),
      () => updateChatKnowledgebase({ chatId, knowledgebaseId: kbId }),
      () => set(previous),
    );
  },
});
