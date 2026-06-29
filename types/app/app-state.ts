import type { ChatRow } from "@/types/chat/chat-row";
import type { MessageRow } from "@/types/message/message-row";
import type { AttachmentRow } from "@/types/attachment/attachment-row";
import type { Prompt } from "@/types/prompt/prompt";
import type { Project } from "@/types/project/project";
import type { Assistant } from "@/types/assistant/assistant";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Attachment } from "@/types/attachment/attachment";
import type { Message } from "@/types/message/message";
import type { Chat } from "@/types/chat/chat";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { TransformAgent } from "@/types/transform/transform-agent";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

/**
 * Global application state shape for the Zustand store.
 * Single source of truth for all entities: projects, assistants, prompts, knowledge bases,
 * chats, MCP servers, and transform agents. Separates optimistic in-memory mutations from
 * database persistence via dedicated "Db" suffixed actions. Chat data is persisted
 * asynchronously via server actions to prevent UI blocking.
 *
 * State structure enables efficient filtering, searching, and relationship traversal
 * without N+1 queries. MCP prompts are ephemeral (cleared on store reset) and discovered
 * on-demand from active servers.
 *
 * @see lib/store/ for store actions and selectors
 * @author Maruf Bepary
 */
export type AppState = {
  // ---- Entity Collections ----

  /**
   * All projects in the workspace.
   * Shared containers for related chats. Empty array until loadProjects is called.
   */
  projects: Project[];

  /**
   * All custom AI assistants.
   * Reusable chat personas with system prompts and tool configurations.
   */
  assistants: Assistant[];

  /**
   * All quick-insert prompts (slash-commands).
   * Power-user snippets for efficient input and common tasks.
   */
  prompts: Prompt[];

  /**
   * Application-wide user settings.
   * Contains default models, global system prompt, and user preferences. One per user.
   */
  userSettings: UserSettingsRow | null;

  /**
   * All chats keyed by their ID.
   * Conversation threads with branching message trees. Maps chatId -> Chat object.
   */
  chats: Record<string, Chat>;

  /**
   * All configured MCP servers.
   * Tool providers that extend AI capabilities with external services and integrations.
   */
  mcpServers: McpServer[];

  /**
   * All publicly shared MCP servers from the community.
   * Read-only variants with credentials stripped. Available for installation.
   */
  publicMcpServers: PublicMcpServer[];

  /**
   * All transform agents (multi-step workflows).
   * Automation templates for bulk document processing and repetitive tasks.
   */
  transformAgents: TransformAgent[];

  /**
   * All discovered MCP prompts (ephemeral).
   * Dynamically loaded from active servers; not persisted across store resets.
   * Populated by loadMcpPrompts action.
   */
  mcpPrompts: DiscoveredPrompt[];

  // ---- Transform Agent Actions ----

  /**
   * Loads all transform agents for the current user from the server.
   * Initializes the transformAgents array on app startup.
   *
   * @returns Promise resolving when transform agents are loaded
   */
  loadTransformAgents: () => Promise<void>;

  /**
   * Triggers discovery of prompts from all enabled MCP servers.
   * Populates mcpPrompts array with discovered prompt definitions from active servers.
   *
   * @returns Promise resolving when prompt discovery completes
   */
  loadMcpPrompts: () => Promise<void>;

  // ---- Chat Message Actions ----

  /**
   * Adds a new message to a chat conversation.
   * Optimistic update: adds to store immediately, persists to database asynchronously.
   * Uses parentId to enable tree structure for branching conversations.
   *
   * @param chatId - ID of the chat to add message to
   * @param role - Message author role (user or assistant)
   * @param content - Message text content
   * @param parentId - ID of parent message for tree structure, null for root
   * @param id - Optional custom message ID; auto-generated if not provided
   * @param metadata - Optional JSON-serialized metadata (tool calls, reasoning tokens)
   * @param attachments - Optional array of file attachments
   * @param reasoning - Optional model reasoning output (extended thinking)
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
   * Deletes a message from local store only.
   * Does not persist to database. Use deleteMessageDb for full deletion.
   *
   * @param chatId - ID of the chat containing the message
   * @param messageId - ID of the message to delete
   */
  deleteMessage: (chatId: string, messageId: string) => void;

  /**
   * Deletes a message from both local store and database.
   * Async operation that cascades to remove all child messages in the tree.
   *
   * @param chatId - ID of the chat containing the message
   * @param messageId - ID of the message to delete
   * @returns Promise resolving when deletion completes on server
   */
  deleteMessageDb: (chatId: string, messageId: string) => Promise<void>;

  /**
   * Sets the current leaf message (active branch endpoint) in the message tree.
   * Determines which message thread continues when user replies.
   * Persists the selection to the database for conversation continuity across sessions.
   *
   * @param chatId - ID of the chat to update
   * @param leafId - ID of the message to set as current leaf
   * @returns Promise resolving when update completes on server
   */
  setCurrentLeafDb: (chatId: string, leafId: string) => Promise<void>;

  /**
   * Updates attachments for a specific message (local store only).
   * Used when processing or extracting content from uploaded files.
   * Does not persist to database.
   *
   * @param chatId - ID of the chat containing the message
   * @param messageId - ID of the message to update
   * @param attachments - New attachment array to replace existing attachments
   */
  updateMessageAttachments: (
    chatId: string,
    messageId: string,
    attachments: Attachment[],
  ) => void;

  /**
   * Updates message metadata (tool calls, reasoning tokens) in store and database.
   * Metadata is JSON-serialized before storage. Persists immediately to server.
   *
   * @param chatId - ID of the chat containing the message
   * @param messageId - ID of the message to update
   * @param metadata - JSON-serialized metadata or null to clear
   * @returns Promise resolving when update completes on server
   */
  updateMessageMetadataDb: (
    chatId: string,
    messageId: string,
    metadata: string | null,
  ) => Promise<void>;

  // ---- Chat Persistence Actions ----

  /**
   * Renames a chat in both local store and database.
   * Immediately reflects in UI. Persists title change to server.
   *
   * @param id - ID of the chat to rename
   * @param title - New title for the chat
   * @returns Promise resolving when rename completes on server
   */
  renameChatDb: (id: string, title: string) => Promise<void>;

  /**
   * Moves a chat to a different project or unbinds it from all projects.
   * Persists the change to the database for consistent organization.
   *
   * @param id - ID of the chat to move
   * @param projectId - Target project ID, or null to unbind from projects
   * @returns Promise resolving when move completes on server
   */
  moveChatDb: (id: string, projectId: string | null) => Promise<void>;

  // ---- Resource Loading Actions ----

  /**
   * Loads all projects for the current user from the server.
   * Populates projects array on app startup and refresh.
   *
   * @returns Promise resolving when projects are loaded
   */
  loadProjects: () => Promise<void>;

  /**
   * Loads all custom AI assistants for the current user from the server.
   * Populates assistants array on app startup.
   *
   * @returns Promise resolving when assistants are loaded
   */
  loadAssistants: () => Promise<void>;

  /**
   * Loads all quick-insert prompts for the current user from the server.
   * Populates prompts array for command palette and snippet insertion.
   *
   * @returns Promise resolving when prompts are loaded
   */
  loadPrompts: () => Promise<void>;

  /**
   * Loads user-wide settings (global prompt, default model, preferences) from the server.
   * Initializes userSettings on app startup.
   *
   * @returns Promise resolving when user settings are loaded
   */
  loadUserSettings: () => Promise<void>;

  /**
   * Loads all MCP servers configured by the current user.
   * Populates mcpServers array with user's tool provider integrations.
   *
   * @returns Promise resolving when MCP servers are loaded
   */
  loadMcpServers: () => Promise<void>;

  /**
   * Loads all publicly shared MCP servers available to the user.
   * Populates publicMcpServers with community-curated tool providers.
   *
   * @returns Promise resolving when public servers are loaded
   */
  loadPublicMcpServers: () => Promise<void>;

  // ---- Chat Loading & Creation Actions ----

  /**
   * Hydrates the store with chat data from database rows.
   * Combines ChatRow, MessageRow, and AttachmentRow into enriched Chat/Message types.
   * Clears existing chats before loading.
   *
   * @param rows - Array of chat rows from database
   * @param messageRows - Array of message rows associated with chats
   * @param attachmentRows - Optional array of attachment rows for messages
   */
  loadChats: (
    rows: ChatRow[],
    messageRows: MessageRow[],
    attachmentRows?: AttachmentRow[],
  ) => void;

  /**
   * Inserts or updates a single chat in the store.
   * Used when creating new chats or receiving server responses.
   * Upsert semantics: creates if not exists, overwrites if exists.
   *
   * @param chat - Chat object to insert or update
   */
  upsertChat: (chat: Chat) => void;

  /**
   * Creates a new chat in both local store and database.
   * Returns the ID of the newly created chat for immediate navigation.
   *
   * @param title - Optional chat title; auto-generated if not provided
   * @param projectId - Optional project to bind chat to
   * @param assistantId - Optional assistant persona for the chat
   * @returns Promise resolving with the ID of created chat
   */
  createChatDb: (
    title?: string,
    projectId?: string,
    assistantId?: string,
  ) => Promise<string>;

  /**
   * Deletes a chat from both local store and database.
   * Cascades to delete all messages and attachments in the chat.
   *
   * @param chatId - ID of the chat to delete
   * @returns Promise resolving when deletion completes on server
   */
  deleteChatDb: (chatId: string) => Promise<void>;

  /**
   * Binds or unbinds a chat to a knowledge base for RAG context.
   * Null kbId removes the knowledge base binding. Persists to database.
   *
   * @param chatId - ID of the chat to update
   * @param kbId - Knowledge base ID to bind, or null to unbind
   * @returns Promise resolving when change completes on server
   */
  setKnowledgebase: (chatId: string, kbId: string | null) => Promise<void>;
};
