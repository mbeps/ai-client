import type { ChatRow } from "@/types/chat-row";
import type { MessageRow } from "@/types/message-row";
import type { AttachmentRow } from "@/types/attachment-row";
import type { Prompt } from "./prompt";
import type { Project } from "./project";
import type { Assistant } from "./assistant";
import type { McpServer } from "./mcp-server";
import type { Attachment } from "./attachment";
import type { Message } from "./message";
import type { Chat } from "./chat";
import type { Knowledgebase } from "./knowledgebase";
import type { TransformAgent } from "./transform-agent";

/**
 * Global application state shape for the Zustand store.
 * Single source of truth for all entities: projects, assistants, prompts, knowledge bases,
 * chats, and MCP servers. Separates optimistic in-memory mutations from database persistence
 * via dedicated "Db" suffixed actions. Chat data is persisted asynchronously via server actions.
 *
 * Entity collections are typically loaded on app initialization via useEffect hooks,
 * then kept in sync with user mutations. Database operations are non-blocking and fail
 * silently with console logging, allowing offline-first optimistic UI.
 *
 * @see useAppStore for the main store hook
 * @see Chat for message tree structure
 * @see Project for workspace grouping
 * @see Assistant for AI persona configuration
 * @author Maruf Bepary
 */
export type AppState = {
  /** All projects in the workspace. */
  projects: Project[];
  /** All custom AI assistants. */
  assistants: Assistant[];
  /** All quick-insert prompts. */
  prompts: Prompt[];
  /** All chats keyed by their ID. */
  chats: Record<string, Chat>;
  /** All configured MCP servers. */
  mcpServers: McpServer[];
  /** All knowledge bases (UI-only; no DB table yet). */
  knowledgebases: Knowledgebase[];
  /** All transform agents. */
  transformAgents: TransformAgent[];
  loadTransformAgents: () => Promise<void>;

  // Chat Actions (Optimistic + Optional DB Sync)
  /**
   * Creates a new empty chat in-memory and returns its ID.
   * Optional projectId and assistantId set context; chats can be created without either.
   * Does not persist to database immediately; use createChatDb for full persistence.
   * @returns ID of the newly created chat
   */
  createChat: (projectId?: string, assistantId?: string) => string;

  /**
   * Adds a new message to a chat, building the branching tree structure.
   * Automatically updates parent's childrenIds and sets currentLeafId to the new message.
   * Optimistic operation; use updateMessageMetadataDb for server persistence.
   */
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

  /**
   * Removes a message and all its descendants from the chat tree (optimistic only).
   * Updates parent's childrenIds and recalculates currentLeafId to nearest ancestor.
   * Changes are not persisted; use deleteMessageDb for database sync.
   */
  deleteMessage: (chatId: string, messageId: string) => void;

  /**
   * Deletes a message from store and database.
   * First applies deleteMessage optimistically, then persists deletion to DB via server action.
   * Errors are logged but do not rollback the optimistic update.
   */
  deleteMessageDb: (chatId: string, messageId: string) => Promise<void>;

  /**
   * Sets the active message leaf for a chat (optimistic only).
   * Changes which message branch is displayed; does not persist immediately.
   * Use setCurrentLeafDb for database persistence.
   */
  setCurrentLeaf: (chatId: string, leafId: string) => void;

  /**
   * Sets the active message leaf and persists to database.
   * First optimistically updates store, then syncs currentLeafId to DB via server action.
   */
  setCurrentLeafDb: (chatId: string, leafId: string) => Promise<void>;

  /**
   * Removes a chat from the store (optimistic only).
   * Does not delete from database; use deleteChatDb for full cleanup.
   */
  deleteChat: (chatId: string) => void;

  /**
   * Updates file attachments on a message (optimistic only).
   * Merges provided attachments by ID, preserving unmodified entries.
   * Use this after file uploads complete to update dataUrl, url, and extractedText.
   */
  updateMessageAttachments: (
    chatId: string,
    messageId: string,
    attachments: Attachment[],
  ) => void;

  /**
   * Updates message metadata (tool calls, reasoning) and persists to database.
   * Metadata is stored as a JSON string containing tool invocation details.
   * Optimistic update followed by server action persistence.
   */
  updateMessageMetadataDb: (
    chatId: string,
    messageId: string,
    metadata: string | null,
  ) => Promise<void>;

  // Chat Persistence Actions
  /**
   * Persists a chat rename to the database.
   * Updates the chat's title field optimistically, then syncs via server action.
   */
  renameChatDb: (id: string, title: string) => Promise<void>;

  /**
   * Moves a chat to a different project (or removes from project if projectId is null).
   * Persists the projectId change to database via server action.
   */
  moveChatDb: (id: string, projectId: string | null) => Promise<void>;

  // Project Actions
  /**
   * Loads all projects from the database and populates the store.
   * Typically called once on app initialization via useEffect.
   */
  loadProjects: () => Promise<void>;

  // Assistant Actions

  /**
   * Loads all assistants from the database and populates the store.
   * Typically called once on app initialization via useEffect.
   */
  loadAssistants: () => Promise<void>;

  // Prompt Actions
  /**
   * Loads all slash-command prompts from the database and populates the store.
   * Typically called once on app initialization via useEffect.
   */
  loadPrompts: () => Promise<void>;

  // Knowledge Base Actions

  // MCP Server Actions
  /**
   * Loads all MCP servers from the database and populates the store.
   * Typically called once on app initialization via useEffect.
   */
  loadMcpServers: () => Promise<void>;

  // Chat Loading Actions
  /**
   * Populates chats and messages in the store from database rows.
   * Reconstructs the branching message tree and attachment associations.
   * Called by chat pages after fetching from database.
   */
  loadChats: (
    rows: ChatRow[],
    messageRows: MessageRow[],
    attachmentRows?: AttachmentRow[],
  ) => void;

  /**
   * Creates a new chat and persists to database.
   * @returns ID of the newly created chat
   */
  createChatDb: (
    title?: string,
    projectId?: string,
    assistantId?: string,
  ) => Promise<string>;

  /**
   * Deletes a chat and all its messages from the database.
   */
  deleteChatDb: (chatId: string) => Promise<void>;

  /**
   * Upserts a chat into the store (creates or updates).
   * Used for synchronizing server-side state changes back to the UI.
   */
  upsertChat: (chat: Chat) => void;
};
