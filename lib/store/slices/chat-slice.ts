import { StateCreator } from "zustand";
import { getDeepestLeaf } from "@/lib/chat/get-deepest-leaf";
import { insertMessage } from "@/lib/chat/insert-message";
import { removeMessageSubtree } from "@/lib/chat/remove-message-subtree";
import { createChat } from "@/lib/actions/chats/create-chat";
import { deleteChat } from "@/lib/actions/chats/delete-chat";
import { renameChat as renameChatAction } from "@/lib/actions/chats/rename-chat";
import { moveChat as moveChatAction } from "@/lib/actions/chats/move-chat";
import { deleteMessage as deleteMessageAction } from "@/lib/actions/chats/delete-message";
import { updateCurrentLeaf as updateCurrentLeafAction } from "@/lib/actions/chats/update-current-leaf";
import { updateMessageMetadata as updateMessageMetadataAction } from "@/lib/actions/chats/update-message-metadata";
import { updateChatKnowledgebase } from "@/lib/actions/chats/update-chat-knowledgebase";

import { mapMessageFromDb } from "../mappers/message-mapper";
import type { AppState } from "@/types/app/app-state";
import type { Message } from "@/types/message/message";
import type { Chat } from "@/types/chat/chat";
import type { ChatRow } from "@/types/chat/chat-row";
import type { MessageRow } from "@/types/message/message-row";
import type { AttachmentRow } from "@/types/attachment/attachment-row";
import type { Attachment } from "@/types/attachment/attachment";

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
  | "setKnowledgebase"
  | "setCurrentLeafDb"
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
 */
export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (
  set,
  get,
) => ({
  chats: {},

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
    get().deleteMessage(chatId, messageId);
    try {
      await deleteMessageAction(chatId, messageId, newLeafId);
    } catch (error) {
      set(previous);
      throw error;
    }
  },

  setCurrentLeafDb: async (chatId, leafId) => {
    const previous = get();
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
    try {
      await updateCurrentLeafAction(chatId, leafId);
    } catch {
      set(previous);
    }
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
    });
    try {
      await updateMessageMetadataAction(messageId, metadata);
    } catch {
      set(previous);
    }
  },

  loadChats: (rows, messageRows, attachmentRows) => {
    const chats: Record<string, Chat> = {};

    for (const row of rows) {
      chats[row.id] = {
        id: row.id,
        title: row.title,
        projectId: row.projectId ?? undefined,
        assistantId: row.assistantId ?? undefined,
        knowledgebaseId: row.knowledgebaseId ?? null,
        updatedAt: new Date(row.updatedAt),
        messages: {},
        currentLeafId: row.currentLeafId ?? null,
      };
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

      const attachmentsForMsg: Attachment[] = safeAttachments
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
            extractedText: att.extractedText ?? undefined,
          };
        });

      chatEntry.messages[m.id] = mapMessageFromDb(
        {
          ...m,
          createdAt: m.createdAt,
        },
        attachmentsForMsg,
      );
    }

    // Pass 2: Reconstruct tree children
    for (const m of messageRows) {
      if (!m.parentId) continue;
      const chatEntry = chats[m.chatId];
      if (!chatEntry) continue;
      const parent = chatEntry.messages[m.parentId];
      if (parent) parent.childrenIds.push(m.id);
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
    });
    try {
      await renameChatAction(id, title);
    } catch {
      set(previous);
    }
  },

  moveChatDb: async (id, projectId) => {
    const previous = get();
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
    });
    try {
      await moveChatAction(id, projectId);
    } catch {
      set(previous);
    }
  },

  createChatDb: async (title, projectId, assistantId) => {
    const row = await createChat(title, projectId, assistantId);
    const newChat = {
      id: row.id,
      title: row.title,
      projectId: row.projectId ?? undefined,
      assistantId: row.assistantId ?? undefined,
      knowledgebaseId: row.knowledgebaseId ?? null,
      updatedAt: new Date(row.updatedAt),
      messages: {},
      currentLeafId: row.currentLeafId ?? null,
    };
    set((state) => ({ chats: { ...state.chats, [row.id]: newChat } }));
    return row.id;
  },

  deleteChatDb: async (chatId) => {
    const previous = get();
    set((state) => {
      const { [chatId]: removed, ...rest } = state.chats;
      return { chats: rest };
    });
    try {
      await deleteChat(chatId);
    } catch {
      set(previous);
    }
  },

  setKnowledgebase: async (chatId, kbId) => {
    const previous = get();
    set((state) => {
      const chat = state.chats[chatId];
      if (!chat) return state;
      return {
        chats: {
          ...state.chats,
          [chatId]: { ...chat, knowledgebaseId: kbId },
        },
      };
    });
    try {
      await updateChatKnowledgebase({ chatId, knowledgebaseId: kbId });
    } catch {
      set(previous);
    }
  },
});
