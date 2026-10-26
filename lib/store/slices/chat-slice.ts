import type { StateCreator } from "zustand";
import { createChat } from "@/actions/chats/create-chat";
import { deleteChat } from "@/actions/chats/delete-chat";
import { deleteMessage as deleteMessageAction } from "@/actions/chats/delete-message";
import { moveChat as moveChatAction } from "@/actions/chats/move-chat";
import { renameChat as renameChatAction } from "@/actions/chats/rename-chat";
import { updateChatKnowledgebase } from "@/actions/chats/update-chat-knowledgebase";
import { updateCurrentLeaf as updateCurrentLeafAction } from "@/actions/chats/update-current-leaf";
import { updateMessageMetadata as updateMessageMetadataAction } from "@/actions/chats/update-message-metadata";
import { ALLOWED_SPREADSHEET_TYPES } from "@/config/attachments";
import { getDeepestLeaf } from "@/lib/chat/get-deepest-leaf";
import { insertMessage } from "@/lib/chat/insert-message";

import { mapMessageFromDb } from "@/lib/chat/map-message-from-db";
import { removeSubtree as removeMessageSubtree } from "@/lib/chat/remove-subtree";
import type { AppState } from "@/types/app/app-state";
import type { Attachment } from "@/types/attachment/attachment";
import type { AttachmentRow } from "@/types/attachment/attachment-row";
import type { Chat } from "@/types/chat/chat";
import type { ChatRow } from "@/types/chat/chat-row";
import type { Message } from "@/types/message/message";
import type { MessageRow } from "@/types/message/message-row";

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
 * Groups an array of raw database message rows by their parent chat ID.
 *
 * @param messageRows - List of raw message rows from the database
 * @returns Map where the key is chatId and value is the list of message rows for that chat
 */
function groupMessagesByChatId(
  messageRows: MessageRow[],
): Map<string, MessageRow[]> {
  const grouped = new Map<string, MessageRow[]>();
  for (const message of messageRows) {
    const list = grouped.get(message.chatId);
    if (list) {
      list.push(message);
    } else {
      grouped.set(message.chatId, [message]);
    }
  }
  return grouped;
}

/**
 * Transforms a raw attachment row from the database into the store's Attachment shape.
 *
 * @param att - Raw attachment row from the database
 * @returns Formatted Attachment domain object
 */
function mapAttachmentRowToAttachment(att: AttachmentRow): Attachment {
  const isImage = att.mimeType.startsWith("image/");
  const isSpreadsheet = ALLOWED_SPREADSHEET_TYPES.has(att.mimeType);
  return {
    id: att.id,
    type: isImage ? "image" : isSpreadsheet ? "spreadsheet" : "document",
    name: att.name,
    mimeType: att.mimeType,
    sizeBytes: att.size,
    dataUrl: "",
    key: att.key,
    extractedText: att.extractedText ?? undefined,
  };
}

/**
 * Resolves the creation date for a chat, prioritizing the database row.
 *
 * @param rowDate - Creation date from the database row
 * @param existingDate - Existing creation date in store if present
 * @returns Date object or undefined
 */
function resolveCreatedAt(
  rowDate: Date | string | null | undefined,
  existingDate: Date | undefined,
): Date | undefined {
  if (rowDate) return new Date(rowDate);
  return existingDate;
}

/**
 * Resolves the active leaf message ID for a chat during hydration.
 *
 * @param rowLeafId - Leaf ID from database row
 * @param existingLeafId - Current leaf ID in store
 * @param hasIncomingMsgs - Whether incoming messages were provided for this chat
 * @returns Target leaf ID or null
 */
function resolveCurrentLeafId(
  rowLeafId: string | null | undefined,
  existingLeafId: string | null | undefined,
  hasIncomingMsgs: boolean,
): string | null {
  if (hasIncomingMsgs) {
    return rowLeafId ?? existingLeafId ?? null;
  }
  return existingLeafId ?? rowLeafId ?? null;
}

/**
 * Constructs an individual Chat domain object from a database row and store state.
 *
 * @param row - Database chat row
 * @param existing - Existing chat in store if present
 * @param hasIncomingMsgs - Whether incoming messages exist for this chat
 * @returns Hydrated Chat object
 */
function buildHydratedChat(
  row: ChatRow,
  existing: Chat | undefined,
  hasIncomingMsgs: boolean,
): Chat {
  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    knowledgebaseId: row.knowledgebaseId ?? null,
    createdAt: resolveCreatedAt(row.createdAt, existing?.createdAt),
    updatedAt: new Date(row.updatedAt),
    messages: hasIncomingMsgs ? {} : (existing?.messages ?? {}),
    currentLeafId: resolveCurrentLeafId(
      row.currentLeafId,
      existing?.currentLeafId,
      hasIncomingMsgs,
    ),
  };
}

/**
 * Initializes Chat records from database rows while preserving or updating existing state.
 *
 * @param rows - Database chat rows to load
 * @param existingChats - Currently loaded chats in the Zustand store
 * @param messageRowsByChatId - Map of incoming message rows grouped by chatId
 * @returns Record of hydrated Chat objects keyed by chatId
 */
function initializeChatsFromRows(
  rows: ChatRow[],
  existingChats: Record<string, Chat>,
  messageRowsByChatId: Map<string, MessageRow[]>,
): Record<string, Chat> {
  const chats: Record<string, Chat> = {};

  for (const row of rows) {
    const existing = existingChats[row.id];
    const incomingMsgs = messageRowsByChatId.get(row.id);
    const hasIncomingMsgs = Boolean(incomingMsgs && incomingMsgs.length > 0);

    chats[row.id] = buildHydratedChat(row, existing, hasIncomingMsgs);
  }

  return chats;
}

/**
 * Hydrates messages and reconstructs the message tree structure for each chat.
 *
 * @param chats - Dictionary of Chat objects being hydrated
 * @param messageRows - List of raw message rows from database
 * @param attachmentRows - Optional list of attachment rows from database
 */
function populateMessagesAndTree(
  chats: Record<string, Chat>,
  messageRows: MessageRow[],
  attachmentRows?: AttachmentRow[],
): void {
  const safeAttachments = attachmentRows ?? [];

  // Pass 1: Create message objects and attach attachments
  for (const m of messageRows) {
    const chatEntry = chats[m.chatId];
    if (!chatEntry) continue;

    const attachmentsForMsg: Attachment[] = safeAttachments
      .filter((a) => a.messageId === m.id)
      .map(mapAttachmentRowToAttachment);

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
}

/**
 * Creates the chat slice of the Zustand store. Manages in-memory chat state, message trees, and branching conversations. Implements optimistic UI patterns with database sync via server actions. Implementation details: - Messages form a tree with parentId and childrenIds for branching - currentLeafId tracks the active message branch for rendering - Recursive deletion handles entire subtrees (message + all descendants) - Tree traversal uses getDeepestLeaf to find terminal nodes.
 *
 * @param set - Target set
 * @param get - Target get
 * @returns The resolved result
 * @author Maruf Bepary
 */
export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (
  set,
  get,
) => ({
  chats: {},

  addMessage: (
    chatId,
    { role, content, parentId, id, metadata, attachments, reasoning },
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
      set({ chats: previous.chats });
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
      set({ chats: previous.chats });
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
      set({ chats: previous.chats });
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
    set((state) => {
      const existing = state.chats[chat.id];
      const hasIncomingMessages =
        chat.messages && Object.keys(chat.messages).length > 0;

      return {
        chats: {
          ...state.chats,
          [chat.id]: {
            ...chat,
            messages: hasIncomingMessages
              ? chat.messages
              : (existing?.messages ?? {}),
            currentLeafId: hasIncomingMessages
              ? chat.currentLeafId
              : (existing?.currentLeafId ?? chat.currentLeafId ?? null),
          },
        },
      };
    });
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
      set({ chats: previous.chats });
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
      set({ chats: previous.chats });
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
      createdAt: new Date(row.createdAt),
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
      set({ chats: previous.chats });
    }
  },

  setKnowledgebaseDb: async (chatId, kbId) => {
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
      set({ chats: previous.chats });
    }
  },

  resetChatState: () => {
    set({ chats: {} });
  },
});
