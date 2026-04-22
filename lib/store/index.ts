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
import { renameChat as renameChatAction } from "@/lib/actions/chats/rename-chat";
import { moveChat as moveChatAction } from "@/lib/actions/chats/move-chat";
import { deleteMessage as deleteMessageAction } from "@/lib/actions/chats/delete-message";
import { updateCurrentLeaf as updateCurrentLeafAction } from "@/lib/actions/chats/update-current-leaf";
import { renameProject as renameProjectAction } from "@/lib/actions/projects/rename-project";
import { listProjects as listProjectsAction } from "@/lib/actions/projects/list-projects";
import { createProject as createProjectAction } from "@/lib/actions/projects/create-project";
import { updateProject as updateProjectAction } from "@/lib/actions/projects/update-project";
import { deleteProject as deleteProjectAction } from "@/lib/actions/projects/delete-project";
import { togglePinProject as togglePinProjectAction } from "@/lib/actions/projects/toggle-pin-project";
import { renameAssistant as renameAssistantAction } from "@/lib/actions/assistants/rename-assistant";
import { listAssistants as listAssistantsAction } from "@/lib/actions/assistants/list-assistants";
import { createAssistant as createAssistantAction } from "@/lib/actions/assistants/create-assistant";
import { updateAssistant as updateAssistantAction } from "@/lib/actions/assistants/update-assistant";
import { deleteAssistant as deleteAssistantAction } from "@/lib/actions/assistants/delete-assistant";
import { renameKnowledgebase as renameKnowledgebaseAction } from "@/lib/actions/knowledgebases/rename-knowledgebase";
import {
  listPrompts as listPromptsAction,
  createPrompt as createPromptAction,
  updatePrompt as updatePromptAction,
  deletePrompt as deletePromptAction,
} from "@/lib/actions/prompts";
import type { ProjectRow } from "@/types/project-row";
import type { AssistantRow } from "@/types/assistant-row";
import type { PromptRow } from "@/types/prompt-row";
import type { ChatRow } from "@/types/chat-row";
import type { MessageRow } from "@/types/message-row";
import type { AttachmentRow } from "@/types/attachment-row";
import {
  listMcpServers as listMcpServersAction,
  createMcpServer as createMcpServerAction,
  deleteMcpServer as deleteMcpServerAction,
  renameMcpServer as renameMcpServerAction,
  toggleMcpServer as toggleMcpServerAction,
  updateMcpServer as updateMcpServerAction,
} from "@/lib/actions/mcp-servers";
import type { CreateMcpServer, UpdateMcpServer } from "@/schemas/mcp-server";

/**
 * A reusable prompt snippet that can be inserted into the chat input via shortcuts.
 *
 * @author Maruf Bepary
 */
export type Prompt = {
  /** Unique prompt identifier. */
  id: string;
  /** Display name shown in the prompt list. */
  title: string;
  /** Keyboard shortcut or trigger string (e.g. "/brief"). */
  shortcut: string;
  /** The actual prompt content to be inserted. */
  content: string;
  /** Timestamp of the most recent modification. */
  updatedAt: Date;
};

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
 * A configured MCP server that provides tools to the AI chat pipeline.
 *
 * @author Maruf Bepary
 */
export type McpServer = {
  id: string;
  name: string;
  type: "stdio" | "http";
  command: string | null;
  args: string | null;
  url: string | null;
  headers: string | null;
  env: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A file attachment on a message — images and documents.
 * Starts local (dataUrl only) and gains S3 fields after upload.
 *
 * @author Maruf Bepary
 */
export type Attachment = {
  /** Unique attachment identifier. */
  id: string;
  /** Whether this is an image or a document. */
  type: "image" | "document";
  /** Original file name. */
  name: string;
  /** MIME type of the file. */
  mimeType: string;
  /** File size in bytes. */
  sizeBytes: number;
  /** Base-64 data URL for local preview. */
  dataUrl: string;
  /** Extracted text content (documents only). */
  extractedText?: string;
  /** S3 object key — set after upload to MinIO. */
  key?: string;
  /** Presigned URL for serving — fetched on demand. */
  url?: string;
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
  /** Optional JSON string for tool call metadata. */
  metadata?: string | null;
  /** AI reasoning/thinking tokens, if present. */
  reasoning?: string;
  /** Files attached to this message. */
  attachments?: Attachment[];
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
  /** Name of the project this chat belongs to (for breadcrumbs). */
  projectName?: string;
  /** Name of the assistant this chat belongs to (for breadcrumbs). */
  assistantName?: string;
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
  /** All quick-insert prompts. */
  prompts: Prompt[];
  /** All knowledge bases. */
  knowledgebases: Knowledgebase[];
  /** All chats keyed by their ID. */
  chats: Record<string, Chat>;
  /** All configured MCP servers. */
  mcpServers: McpServer[];

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
    metadata?: string | null,
    attachments?: Attachment[],
    reasoning?: string,
  ) => void;
  /** Removes a message and all its descendants from the tree. */
  deleteMessage: (chatId: string, messageId: string) => void;
  /** Deletes a message and all its descendants from the DB and the store. */
  deleteMessageDb: (chatId: string, messageId: string) => Promise<void>;
  /** Updates the active leaf node for a chat, switching the visible conversation branch. */
  setCurrentLeaf: (chatId: string, leafId: string) => void;
  /** Persists the active leaf node for a chat to the DB and updates state. */
  setCurrentLeafDb: (chatId: string, leafId: string) => Promise<void>;
  /** Removes an entire chat and its message tree from the store. */
  deleteChat: (chatId: string) => void;
  /** Patches attachment metadata (e.g. S3 key) on an existing message after upload. */
  updateMessageAttachments: (
    chatId: string,
    messageId: string,
    attachments: Attachment[],
  ) => void;

  // DB-backed actions
  /** Updates a chat's title in both DB and local state. */
  renameChatDb: (id: string, title: string) => Promise<void>;
  /** Changes a chat's linked project in both DB and local state. */
  moveChatDb: (id: string, projectId: string | null) => Promise<void>;
  /** Updates a project's name in both DB and local state. */
  renameProjectDb: (id: string, name: string) => Promise<void>;
  /** Fetches all projects from the DB and sets them in state. */
  loadProjects: () => Promise<void>;
  /**
   * Hydrates projects from DB rows without a network call.
   *
   * OPTIMIZATION: This allows the client to have access to project global prompts
   * immediately on page load via SSR props, avoiding subsequent fetch requests.
   */
  loadProjectRows: (rows: ProjectRow[]) => void;
  /** Creates a new project in the DB and adds it to state; returns the new project's ID. */
  createProjectDb: (data: {
    name: string;
    description?: string;
  }) => Promise<string>;
  /** Updates a project's fields in the DB and updates state. */
  updateProjectDb: (
    id: string,
    data: { name?: string; description?: string; globalPrompt?: string },
  ) => Promise<void>;
  /** Deletes a project from the DB and removes it from state. */
  deleteProjectDb: (id: string) => Promise<void>;
  /** Toggles the pinned state of a project in the DB and updates state. */
  toggleProjectPinDb: (id: string) => Promise<void>;
  /** Updates an assistant's name in both DB and local state. */
  renameAssistantDb: (id: string, name: string) => Promise<void>;
  /** Fetches all assistants from the DB and sets them in state. */
  loadAssistants: () => Promise<void>;
  /**
   * Hydrates assistants from DB rows without a network call.
   *
   * OPTIMIZATION: This allows the client to have access to assistant persona prompts
   * immediately on page load via SSR props, avoiding subsequent fetch requests.
   */
  loadAssistantRows: (rows: AssistantRow[]) => void;
  /** Creates a new assistant in the DB and adds it to state; returns the new assistant's ID. */
  createAssistantDb: (data: {
    name: string;
    description?: string;
    prompt?: string;
  }) => Promise<string>;
  /** Updates an assistant's fields in the DB and updates state. */
  updateAssistantDb: (
    id: string,
    data: { name?: string; description?: string; prompt?: string },
  ) => Promise<void>;
  /** Deletes an assistant from the DB and removes it from state. */
  deleteAssistantDb: (id: string) => Promise<void>;

  /** Fetches all prompts from the DB and sets them in state. */
  loadPrompts: () => Promise<void>;
  /** Creates a new prompt in the DB and adds it to state. */
  createPromptDb: (data: {
    title: string;
    shortcut: string;
    content: string;
  }) => Promise<string>;
  /** Updates a prompt's fields in the DB and updates state. */
  updatePromptDb: (
    id: string,
    data: { title?: string; shortcut?: string; content?: string },
  ) => Promise<void>;
  /** Deletes a prompt from the DB and removes it from state. */
  deletePromptDb: (id: string) => Promise<void>;

  /** Updates a knowledgebase's name in both DB and local state. */
  renameKnowledgebaseDb: (id: string, name: string) => Promise<void>;

  /** Fetches all MCP servers from the DB and sets them in state. */
  loadMcpServers: () => Promise<void>;
  /** Creates a new MCP server in the DB and adds it to state. */
  addMcpServer: (data: CreateMcpServer) => Promise<void>;
  /** Deletes an MCP server from the DB and removes it from state. */
  removeMcpServer: (id: string) => Promise<void>;
  /** Renames an MCP server in the DB and updates state. */
  renameMcpServer: (id: string, name: string) => Promise<void>;
  /** Toggles an MCP server's enabled state in the DB and updates state. */
  toggleMcpServer: (id: string) => Promise<void>;
  /** Updates an MCP server's configuration in the DB and updates state. */
  updateMcpServer: (id: string, data: UpdateMcpServer) => Promise<void>;

  /** Hydrates the store from a flat list of DB rows, rebuilding childrenIds. */
  loadChats: (
    rows: ChatRow[],
    messageRows: MessageRow[],
    attachmentRows?: AttachmentRow[],
  ) => void;
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
 * Maps a ProjectRow from the DB to the Zustand Project shape.
 */
export function projectRowToStore(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    isPinned: row.isPinned,
    updatedAt: new Date(row.updatedAt),
    globalPrompt: row.globalPrompt ?? "",
    knowledgebases: [],
  };
}

/**
 * Maps an AssistantRow from the DB to the Zustand Assistant shape.
 */
export function assistantRowToStore(row: AssistantRow): Assistant {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    prompt: row.prompt ?? "",
    tools: [],
    knowledgebases: [],
    avatar: row.avatar ?? undefined,
    updatedAt: new Date(row.updatedAt),
  };
}

/**
 * Maps a PromptRow from the DB to the Zustand Prompt shape.
 */
export function promptRowToStore(row: PromptRow): Prompt {
  return {
    id: row.id,
    title: row.title,
    shortcut: row.shortcut,
    content: row.content,
    updatedAt: new Date(row.updatedAt),
  };
}

/**
 * Maps a ChatRow from the DB to the Zustand Chat shape.
 */
export function chatRowToStore(row: ChatRow): Chat {
  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    updatedAt: new Date(row.updatedAt),
    messages: {},
    currentLeafId: row.currentLeafId ?? null,
  };
}

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
  prompts: [],
  knowledgebases: [],
  chats: {},
  mcpServers: [],

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

  deleteMessageDb: async (chatId, messageId) => {
    // 1. Optimistic: compute new leaf and mutate Zustand immediately
    get().deleteMessage(chatId, messageId);
    // 2. Read the new leaf from state after the optimistic update
    const newLeafId = get().chats[chatId]?.currentLeafId ?? null;
    // 3. Persist deletion to DB
    try {
      await deleteMessageAction(chatId, messageId, newLeafId);
    } catch (err) {
      console.error("Failed to delete message from DB:", err);
    }
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

  setCurrentLeafDb: async (chatId, leafId) => {
    get().setCurrentLeaf(chatId, leafId);
    try {
      await updateCurrentLeafAction(chatId, leafId);
    } catch (err) {
      console.error("Failed to update current leaf:", err);
    }
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
          const parsed = JSON.parse(m.metadata);
          parsedReasoning = parsed?.reasoning ?? undefined;
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

  renameProjectDb: async (id, name) => {
    const updated = await renameProjectAction(id, name);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id
          ? { ...p, name: updated.name, updatedAt: new Date(updated.updatedAt) }
          : p,
      ),
    }));
  },

  renameAssistantDb: async (id, name) => {
    const updated = await renameAssistantAction(id, name);
    set((state) => ({
      assistants: state.assistants.map((a) =>
        a.id === id
          ? { ...a, name: updated.name, updatedAt: new Date(updated.updatedAt) }
          : a,
      ),
    }));
  },

  renameKnowledgebaseDb: async (id, name) => {
    const updated = await renameKnowledgebaseAction(id, name);
    set((state) => ({
      knowledgebases: state.knowledgebases.map((kb) =>
        kb.id === id
          ? {
              ...kb,
              name: updated.name,
              updatedAt: new Date(updated.updatedAt),
            }
          : kb,
      ),
    }));
  },

  loadProjectRows: (rows) => {
    set({ projects: rows.map(projectRowToStore) });
  },

  loadProjects: async () => {
    const rows = await listProjectsAction();
    set({ projects: rows.map(projectRowToStore) });
  },

  createProjectDb: async (data) => {
    const row = await createProjectAction(data);
    set((state) => ({ projects: [projectRowToStore(row), ...state.projects] }));
    return row.id;
  },

  updateProjectDb: async (id, data) => {
    const row = await updateProjectAction(id, data);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...projectRowToStore(row) } : p,
      ),
    }));
  },

  deleteProjectDb: async (id) => {
    await deleteProjectAction(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      chats: Object.fromEntries(
        Object.entries(state.chats).map(([chatId, chat]) =>
          chat.projectId === id
            ? [chatId, { ...chat, projectId: undefined }]
            : [chatId, chat],
        ),
      ),
    }));
  },

  toggleProjectPinDb: async (id) => {
    const row = await togglePinProjectAction(id);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id
          ? { ...p, isPinned: row.isPinned, updatedAt: new Date(row.updatedAt) }
          : p,
      ),
    }));
  },

  loadAssistantRows: (rows) => {
    set({ assistants: rows.map(assistantRowToStore) });
  },

  loadAssistants: async () => {
    const rows = await listAssistantsAction();
    set({ assistants: rows.map(assistantRowToStore) });
  },

  createAssistantDb: async (data) => {
    const row = await createAssistantAction(data);
    set((state) => ({
      assistants: [assistantRowToStore(row), ...state.assistants],
    }));
    return row.id;
  },

  updateAssistantDb: async (id, data) => {
    const row = await updateAssistantAction(id, data);
    set((state) => ({
      assistants: state.assistants.map((a) =>
        a.id === id ? { ...a, ...assistantRowToStore(row) } : a,
      ),
    }));
  },

  deleteAssistantDb: async (id) => {
    await deleteAssistantAction(id);
    set((state) => ({
      assistants: state.assistants.filter((a) => a.id !== id),
      chats: Object.fromEntries(
        Object.entries(state.chats).map(([chatId, chat]) =>
          chat.assistantId === id
            ? [chatId, { ...chat, assistantId: undefined }]
            : [chatId, chat],
        ),
      ),
    }));
  },

  loadPrompts: async () => {
    const rows = await listPromptsAction();
    set({ prompts: rows.map(promptRowToStore) });
  },

  createPromptDb: async (data) => {
    const row = await createPromptAction(data);
    set((state) => ({ prompts: [promptRowToStore(row), ...state.prompts] }));
    return row.id;
  },

  updatePromptDb: async (id, data) => {
    const row = await updatePromptAction(id, data);
    set((state) => ({
      prompts: state.prompts.map((p) =>
        p.id === id ? { ...p, ...promptRowToStore(row) } : p,
      ),
    }));
  },

  deletePromptDb: async (id) => {
    await deletePromptAction(id);
    set((state) => ({
      prompts: state.prompts.filter((p) => p.id !== id),
    }));
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

  loadMcpServers: async () => {
    const rows = await listMcpServersAction();
    set({
      mcpServers: rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        command: r.command,
        args: r.args,
        url: r.url,
        headers: r.headers,
        env: r.env,
        enabled: r.enabled,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    });
  },

  addMcpServer: async (data) => {
    const row = await createMcpServerAction(data);
    set((state) => ({
      mcpServers: [
        {
          id: row.id,
          name: row.name,
          type: row.type,
          command: row.command,
          args: row.args,
          url: row.url,
          headers: row.headers,
          env: row.env,
          enabled: row.enabled,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
        ...state.mcpServers,
      ],
    }));
  },

  removeMcpServer: async (id) => {
    await deleteMcpServerAction(id);
    set((state) => ({
      mcpServers: state.mcpServers.filter((s) => s.id !== id),
    }));
  },

  renameMcpServer: async (id, name) => {
    const updated = await renameMcpServerAction(id, name);
    set((state) => ({
      mcpServers: state.mcpServers
        .map((s) =>
          s.id === id
            ? {
                ...s,
                name: updated.name,
                updatedAt: new Date(updated.updatedAt),
              }
            : s,
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    }));
  },

  toggleMcpServer: async (id) => {
    const updated = await toggleMcpServerAction(id);
    set((state) => ({
      mcpServers: state.mcpServers.map((s) =>
        s.id === id
          ? {
              ...s,
              enabled: updated.enabled,
              updatedAt: new Date(updated.updatedAt),
            }
          : s,
      ),
    }));
  },

  updateMcpServer: async (id, data) => {
    const updated = await updateMcpServerAction(id, data);
    set((state) => ({
      mcpServers: state.mcpServers
        .map((s) =>
          s.id === id
            ? {
                id: updated.id,
                name: updated.name,
                type: updated.type,
                command: updated.command,
                args: updated.args,
                url: updated.url,
                headers: updated.headers,
                env: updated.env,
                enabled: updated.enabled,
                createdAt: new Date(updated.createdAt),
                updatedAt: new Date(updated.updatedAt),
              }
            : s,
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    }));
  },
}));
