import { StateCreator } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { getDeepestLeaf } from "@/lib/chat/tree-utils";
import { createChat } from "@/lib/actions/chats/create-chat";
import { deleteChat } from "@/lib/actions/chats/delete-chat";
import { renameChat as renameChatAction } from "@/lib/actions/chats/rename-chat";
import { moveChat as moveChatAction } from "@/lib/actions/chats/move-chat";
import { deleteMessage as deleteMessageAction } from "@/lib/actions/chats/delete-message";
import { updateCurrentLeaf as updateCurrentLeafAction } from "@/lib/actions/chats/update-current-leaf";
import { messageMetadataSchema } from "@/schemas/chat";
import { chatRowToStore } from "../mappers/chat";
import type { AppState } from "@/types/app-state";
import type { Message } from "@/types/message";
import type { Chat } from "@/types/chat";

export type ChatSlice = Pick<
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
  | "loadChats"
  | "upsertChat"
  | "renameChatDb"
  | "moveChatDb"
  | "createChatDb"
  | "deleteChatDb"
>;

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (
  set,
  get,
) => ({
  chats: {},

  createChat: (projectId, assistantId) => {
    const newChatId = uuidv4();
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
    const newMessageId = id ?? uuidv4();
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

      const updatedMessages = { ...chat.messages, [newMessageId]: newMessage };

      if (parentId && updatedMessages[parentId]) {
        updatedMessages[parentId] = {
          ...updatedMessages[parentId],
          childrenIds: [...updatedMessages[parentId].childrenIds, newMessageId],
        };
      }

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

      const updatedMessages = { ...chat.messages };

      const deleteRecursive = (id: string) => {
        const msg = updatedMessages[id];
        if (!msg) return;
        msg.childrenIds.forEach(deleteRecursive);
        delete updatedMessages[id];
      };

      const msg = updatedMessages[messageId];
      if (msg && msg.parentId && updatedMessages[msg.parentId]) {
        updatedMessages[msg.parentId] = {
          ...updatedMessages[msg.parentId],
          childrenIds: updatedMessages[msg.parentId].childrenIds.filter(
            (id) => id !== messageId,
          ),
        };
      }

      deleteRecursive(messageId);

      let newLeaf = msg?.parentId || null;
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
    get().deleteMessage(chatId, messageId);
    const newLeafId = get().chats[chatId]?.currentLeafId ?? null;
    try {
      await deleteMessageAction(chatId, messageId, newLeafId);
    } catch (err) {
      console.error("Failed to delete message from DB:", err);
    }
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
    get().setCurrentLeaf(chatId, leafId);
    try {
      await updateCurrentLeafAction(chatId, leafId);
    } catch (err) {
      console.error("Failed to update current leaf:", err);
    }
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

  loadChats: (rows, messageRows, attachmentRows) => {
    const chats: Record<string, Chat> = {};

    for (const row of rows) {
      chats[row.id] = chatRowToStore(row);
    }

    for (const m of messageRows) {
      const chatEntry = chats[m.chatId];
      if (!chatEntry) continue;
      let parsedReasoning: string | undefined;
      if (m.metadata) {
        try {
          const raw = JSON.parse(m.metadata);
          const parsed = messageMetadataSchema.safeParse(raw);
          parsedReasoning = parsed.success ? parsed.data.reasoning : undefined;
        } catch {
          parsedReasoning = undefined;
        }
      }
      chatEntry.messages[m.id] = {
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: new Date(m.createdAt),
        parentId: m.parentId,
        childrenIds: [],
        metadata: m.metadata ?? null,
        reasoning: parsedReasoning,
        attachments: [],
      };
    }

    for (const m of messageRows) {
      if (!m.parentId) continue;
      const chatEntry = chats[m.chatId];
      if (!chatEntry) continue;
      const parent = chatEntry.messages[m.parentId];
      if (parent) parent.childrenIds.push(m.id);
    }

    if (attachmentRows) {
      for (const att of attachmentRows) {
        for (const chatEntry of Object.values(chats)) {
          const msg = chatEntry.messages[att.messageId];
          if (msg) {
            const isImage = att.mimeType.startsWith("image/");
            msg.attachments = msg.attachments || [];
            msg.attachments.push({
              id: att.id,
              type: isImage ? "image" : "document",
              name: att.name,
              mimeType: att.mimeType,
              sizeBytes: att.size,
              dataUrl: "",
              key: att.key,
            });
            break;
          }
        }
      }
    }

    set({ chats });
  },

  upsertChat: (chat) => {
    set((state) => ({
      chats: { ...state.chats, [chat.id]: chat },
    }));
  },

  renameChatDb: async (id, title) => {
    const updated = await renameChatAction(id, title);
    set((state) => {
      const chat = state.chats[id];
      if (!chat) return state;
      return {
        chats: {
          ...state.chats,
          [id]: {
            ...chat,
            title: updated.title,
            updatedAt: new Date(updated.updatedAt),
          },
        },
      };
    });
  },

  moveChatDb: async (id, projectId) => {
    const updated = await moveChatAction(id, projectId);
    set((state) => {
      const chat = state.chats[id];
      if (!chat) return state;
      return {
        chats: {
          ...state.chats,
          [id]: {
            ...chat,
            projectId: updated.projectId ?? undefined,
            updatedAt: new Date(updated.updatedAt),
          },
        },
      };
    });
  },

  createChatDb: async (title, projectId, assistantId) => {
    const row = await createChat(title, projectId, assistantId);
    const newChat = chatRowToStore(row);
    set((state) => ({ chats: { ...state.chats, [row.id]: newChat } }));
    return row.id;
  },

  deleteChatDb: async (chatId) => {
    await deleteChat(chatId);
    set((state) => {
      const next = { ...state.chats };
      delete next[chatId];
      return { chats: next };
    });
  },
});
