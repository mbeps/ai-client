import type { ProjectRow } from "@/types/project-row";
import type { AssistantRow } from "@/types/assistant-row";
import type { PromptRow } from "@/types/prompt-row";
import type { ChatRow } from "@/types/chat-row";
import type { MessageRow } from "@/types/message-row";
import type { AttachmentRow } from "@/types/attachment-row";
import type { CreateMcpServer, UpdateMcpServer } from "@/schemas/mcp-server";
import type { Prompt } from "./prompt";
import type { Project } from "./project";
import type { Assistant } from "./assistant";
import type { Knowledgebase } from "./knowledgebase";
import type { McpServer } from "./mcp-server";
import type { Attachment } from "./attachment";
import type { Message } from "./message";
import type { Chat } from "./chat";

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
export type AppState = {"
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
   * Toggles a project's pin status in the sidebar (optimistic then persisted).
   * Pinned projects appear at the top of the project list.
   */
  toggleProjectPin: (id: string) => void;

  /**
   * Loads all projects from the database and populates the store.
   * Typically called once on app initialization via useEffect.
   */
  loadProjects: () => Promise<void>;

  /**
   * Populates projects in the store from database rows (internal use).
   * Called by loadProjects after fetching database records.
   */
  loadProjectRows: (rows: ProjectRow[]) => void;

  /**
   * Creates a new project and persists to database.
   * @returns ID of the newly created project
   */
  createProjectDb: (data: {
    name: string;
    description?: string;
  }) => Promise<string>;

  /**
   * Updates project properties (name, description, globalPrompt) in database.
   */
  updateProjectDb: (
    id: string,
    data: { name?: string; description?: string; globalPrompt?: string },
  ) => Promise<void>;

  /**
   * Deletes a project and all its associated chats from the database.
   */
  deleteProjectDb: (id: string) => Promise<void>;

  /**
   * Persists a project's pin status to the database.
   */
  toggleProjectPinDb: (id: string) => Promise<void>;

  // Assistant Actions
  /**
   * Persists an assistant rename to the database.
   */
  renameAssistantDb: (id: string, name: string) => Promise<void>;

  /**
   * Loads all assistants from the database and populates the store.
   * Typically called once on app initialization via useEffect.
   */
  loadAssistants: () => Promise<void>;

  /**
   * Populates assistants in the store from database rows (internal use).
   * Called by loadAssistants after fetching database records.
   */
  loadAssistantRows: (rows: AssistantRow[]) => void;

  /**
   * Creates a new assistant and persists to database.
   * @returns ID of the newly created assistant
   */
  createAssistantDb: (data: {
    name: string;
    description?: string;
    prompt?: string;
  }) => Promise<string>;

  /**
   * Updates assistant properties (name, description, prompt) in database.
   */
  updateAssistantDb: (
    id: string,
    data: { name?: string; description?: string; prompt?: string },
  ) => Promise<void>;

  /**
   * Deletes an assistant from the database.
   */
  deleteAssistantDb: (id: string) => Promise<void>;

  // Prompt Actions
  /**
   * Loads all slash-command prompts from the database and populates the store.
   * Typically called once on app initialization via useEffect.
   */
  loadPrompts: () => Promise<void>;

  /**
   * Creates a new prompt (slash-command snippet) and persists to database.
   * @returns ID of the newly created prompt
   */
  createPromptDb: (data: {
    title: string;
    shortcut: string;
    content: string;
  }) => Promise<string>;

  /**
   * Updates prompt properties (title, shortcut, content) in database.
   */
  updatePromptDb: (
    id: string,
    data: { title?: string; shortcut?: string; content?: string },
  ) => Promise<void>;

  /**
   * Deletes a prompt from the database.
   */
  deletePromptDb: (id: string) => Promise<void>;

  // Knowledge Base Actions
  /**
   * Persists a knowledge base rename to the database.
   */
  renameKnowledgebaseDb: (id: string, name: string) => Promise<void>;

  // MCP Server Actions
  /**
   * Loads all MCP servers from the database and populates the store.
   * Typically called once on app initialization via useEffect.
   */
  loadMcpServers: () => Promise<void>;

  /**
   * Creates a new MCP server configuration and persists to database.
   */
  addMcpServer: (data: CreateMcpServer) => Promise<void>;

  /**
   * Removes an MCP server from the database.
   */
  removeMcpServer: (id: string) => Promise<void>;

  /**
   * Persists an MCP server rename to the database.
   */
  renameMcpServer: (id: string, name: string) => Promise<void>;

  /**
   * Toggles an MCP server's enabled/disabled status in the database.
   */
  toggleMcpServer: (id: string) => Promise<void>;

  /**
   * Updates MCP server configuration (command, url, headers, env) in database.
   */
  updateMcpServer: (id: string, data: UpdateMcpServer) => Promise<void>;

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
