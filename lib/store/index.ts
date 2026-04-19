/**
 * Centralised in-memory application state using Zustand.
 * Single source of truth for Projects, Assistants, Knowledge Bases, Chats, and Messages.
 * Chat data is not yet persisted to the database — all state resets on page refresh.
 *
 * @see useAppStore for the main store hook
 * @author Maruf Bepary
 */
import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { getDeepestLeaf } from "@/lib/chat/tree-utils";
import { createChat } from "@/lib/actions/chats/create-chat";
import { deleteChat } from "@/lib/actions/chats/delete-chat";
import type { ChatRow, MessageRow } from "@/lib/actions/chats/types";

/**
 * A grouped workspace that links chats to a shared system prompt and knowledge bases.
 *
 * @author Maruf Bepary
 */
export type Project = {
  /** Unique project identifier. */
  id: string;
  /** Display name shown in the project grid. */
  name: string;
  /** Short description shown on the project card. */
  description: string;
  /** Whether the project is pinned to the top of the list. */
  isPinned: boolean;
  /** Timestamp of the most recent modification. */
  updatedAt: Date;
  /** System prompt injected as context into all new chats within this project. */
  globalPrompt: string;
  /** IDs of knowledge bases attached to this project. */
  knowledgebases: string[];
};

/**
 * A custom AI persona with a system prompt, enabled tools, and linked knowledge bases.
 *
 * @author Maruf Bepary
 */
export type Assistant = {
  /** Unique assistant identifier. */
  id: string;
  /** Display name shown in the assistant grid. */
  name: string;
  /** Short description shown on the assistant card. */
  description: string;
  /** System prompt that defines this assistant's persona and behaviour. */
  prompt: string;
  /** Identifiers of MCP tools enabled for this assistant. */
  tools: string[];
  /** IDs of knowledge bases linked to this assistant. */
  knowledgebases: string[];
  /** Optional URL or path to the assistant's avatar image. */
  avatar?: string;
  /** Timestamp of the most recent modification. */
  updatedAt: Date;
};

/**
 * A named document collection that provides AI context for projects and assistants.
 *
 * @author Maruf Bepary
 */
export type Knowledgebase = {
  /** Unique knowledge base identifier. */
  id: string;
  /** Display name shown in the knowledge base grid. */
  name: string;
  /** Short description shown on the knowledge base card. */
  description: string;
  /** Current total size of all stored documents in bytes. */
  sizeBytes: number;
  /** Maximum allowed storage capacity in bytes. */
  maxSizeBytes: number;
  /** Number of documents stored in this knowledge base. */
  documentCount: number;
  /** Timestamp of the most recent modification. */
  updatedAt: Date;
};

/**
 * A single message node within a branching conversation tree.
 * Multiple children on a node indicate a branch point (e.g. after an edit).
 *
 * @author Maruf Bepary
 */
export type Message = {
  /** Unique message identifier. */
  id: string;
  /** Whether the message was sent by the human user or the AI assistant. */
  role: "user" | "assistant";
  /** Text body of the message. */
  content: string;
  /** When this message was created. */
  createdAt: Date;
  /** ID of the parent message in the tree, or null for the root message. */
  parentId: string | null;
  /** IDs of direct child messages; more than one child means a branch exists at this node. */
  childrenIds: string[];
};

/**
 * A conversation thread backed by a branching message tree.
 * Editing a message creates a new child branch rather than mutating history.
 *
 * @author Maruf Bepary
 */
export type Chat = {
  /** Unique chat identifier. */
  id: string;
  /** Human-readable title displayed in the sidebar and chat list. */
  title: string;
  /** ID of the project this chat belongs to, if any. */
  projectId?: string;
  /** ID of the assistant this chat is bound to, if any. */
  assistantId?: string;
  /** Timestamp of the most recent modification. */
  updatedAt: Date;
  /** Flat map of all messages keyed by ID, forming the full message tree. */
  messages: Record<string, Message>;
  /** ID of the active leaf node; walking from root to this node reconstructs the visible thread. */
  currentLeafId: string | null;
};

/**
 * Shape of the global Zustand store, combining all entity collections and mutation actions.
 * @author Maruf Bepary
 */
type AppState = {
  /** All projects in the workspace. */
  projects: Project[];
  /** All custom AI assistants. */
  assistants: Assistant[];
  /** All knowledge bases. */
  knowledgebases: Knowledgebase[];
  /** All chats keyed by their ID. */
  chats: Record<string, Chat>;

  // Actions
  /** Toggles the pinned state of a project. */
  toggleProjectPin: (id: string) => void;
  /** Creates a new empty chat, optionally scoped to a project or assistant, and returns its ID. */
  createChat: (projectId?: string, assistantId?: string) => string;
  /** Appends a new message to the chat's tree, linking it to parentId, and advances currentLeafId. */
  addMessage: (
    chatId: string,
    role: "user" | "assistant",
    content: string,
    parentId: string | null,
    id?: string,
  ) => void;
  /** Removes a message and all its descendants from the tree. */
  deleteMessage: (chatId: string, messageId: string) => void;
  /** Updates the active leaf node for a chat, switching the visible conversation branch. */
  setCurrentLeaf: (chatId: string, leafId: string) => void;
  /** Removes an entire chat and its message tree from the store. */
  deleteChat: (chatId: string) => void;

  // DB-backed actions
  /** Hydrates the store from a flat list of DB rows, rebuilding childrenIds. */
  loadChats: (rows: ChatRow[], messageRows: MessageRow[]) => void;
  /** Creates a new chat in the DB and adds it to the store; returns the new chat's ID. */
  createChatDb: (
    title?: string,
    projectId?: string,
    assistantId?: string,
  ) => Promise<string>;
  /** Deletes a chat from the DB and removes it from the store. */
  deleteChatDb: (chatId: string) => Promise<void>;
  /** Inserts or replaces a chat entry in the store. */
  upsertChat: (chat: Chat) => void;
};

/**
 * Global Zustand store hook for the AI chat client.
 * Manages projects, assistants, knowledge bases, and chats entirely in-memory.
 * Chat data is not yet persisted to the database.
 *
 * @author Maruf Bepary
 */
export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  assistants: [],
  knowledgebases: [],
  chats: {},

  /**
   * Toggles the pinned state of a project.
   *
   * @param id - ID of the project to pin or unpin.
   */
  toggleProjectPin: (id) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, isPinned: !p.isPinned } : p,
      ),
    })),

  /**
   * Creates a new empty chat, optionally scoped to a project or assistant.
   *
   * @param projectId - Optional project to scope the chat to.
   * @param assistantId - Optional assistant to bind the chat to.
   * @returns The newly created chat's ID.
   */
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

  /**
   * Appends a new message to the chat's tree, links it to parentId,
   * registers it as a child of its parent, and advances currentLeafId.
   *
   * @param chatId - Target chat ID.
   * @param role - Whether the message is from the user or the assistant.
   * @param content - Text body of the message.
   * @param parentId - Parent message ID in the tree, or null for a root message.
   */
  addMessage: (chatId, role, content, parentId, id) => {
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

  /**
   * Removes a message and all its descendants from the tree.
   * Walks back up to the parent and sets currentLeafId to the deepest remaining leaf.
   *
   * @param chatId - Chat the message belongs to.
   * @param messageId - ID of the message to delete.
   */
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

  /**
   * Sets the active leaf node for a chat, switching the visible conversation branch.
   *
   * @param chatId - Chat to update.
   * @param leafId - ID of the message node to activate as the current leaf.
   */
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

  /**
   * Removes an entire chat and its message tree from the store.
   *
   * @param chatId - ID of the chat to delete.
   */
  deleteChat: (chatId) => {
    set((state) => {
      const { [chatId]: removed, ...rest } = state.chats;
      return { chats: rest };
    });
  },

  loadChats: (rows, messageRows) => {
    const chats: Record<string, Chat> = {};

    for (const row of rows) {
      chats[row.id] = {
        id: row.id,
        title: row.title,
        projectId: row.projectId ?? undefined,
        assistantId: row.assistantId ?? undefined,
        updatedAt: new Date(row.updatedAt),
        messages: {},
        currentLeafId: row.currentLeafId,
      };
    }

    for (const m of messageRows) {
      const chatEntry = chats[m.chatId];
      if (!chatEntry) continue;
      chatEntry.messages[m.id] = {
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: new Date(m.createdAt),
        parentId: m.parentId,
        childrenIds: [],
      };
    }

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

  createChatDb: async (title, projectId, assistantId) => {
    const row = await createChat(title, projectId, assistantId);
    const newChat: Chat = {
      id: row.id,
      title: row.title,
      projectId: row.projectId ?? undefined,
      assistantId: row.assistantId ?? undefined,
      updatedAt: new Date(row.updatedAt),
      messages: {},
      currentLeafId: null,
    };
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
}));
