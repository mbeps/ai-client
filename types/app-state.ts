import type { ChatRow } from "@/types/chat-row";
import type { MessageRow } from "@/types/message-row";
import type { AttachmentRow } from "@/types/attachment-row";
import type { Prompt } from "./prompt";
import type { Project } from "./project";
import type { Assistant } from "./assistant";
import type { McpServer } from "./mcp-server";
import type { PublicMcpServer } from "./public-mcp-server";
import type { Attachment } from "./attachment";
import type { Message } from "./message";
import type { Chat } from "./chat";
import type { Knowledgebase } from "./knowledgebase";
import type { TransformAgent } from "./transform-agent";
import type { DiscoveredPrompt } from "./mcp/discovered-prompt";

/**
 * Global application state shape for the Zustand store.
 * Single source of truth for all entities: projects, assistants, prompts, knowledge bases,
 * chats, and MCP servers. Separates optimistic in-memory mutations from database persistence
 * via dedicated "Db" suffixed actions. Chat data is persisted asynchronously via server actions.
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
  /** All publicly shared MCP servers from the community. */
  publicMcpServers: PublicMcpServer[];
  /** All knowledge bases. */
  knowledgebases: Knowledgebase[];
  /** All transform agents. */
  transformAgents: TransformAgent[];
  /** All discovered MCP prompts (ephemeral). */
  mcpPrompts: DiscoveredPrompt[];
  
  loadTransformAgents: () => Promise<void>;
  /** Triggers discovery of prompts from all enabled MCP servers. */
  loadMcpPrompts: () => Promise<void>;

  // Chat Actions
  createChat: (projectId?: string, assistantId?: string) => string;
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
  deleteMessage: (chatId: string, messageId: string) => void;
  deleteMessageDb: (chatId: string, messageId: string) => Promise<void>;
  setCurrentLeaf: (chatId: string, leafId: string) => void;
  setCurrentLeafDb: (chatId: string, leafId: string) => Promise<void>;
  deleteChat: (chatId: string) => void;
  updateMessageAttachments: (
    chatId: string,
    messageId: string,
    attachments: Attachment[],
  ) => void;
  updateMessageMetadataDb: (
    chatId: string,
    messageId: string,
    metadata: string | null,
  ) => Promise<void>;

  // Chat Persistence Actions
  renameChatDb: (id: string, title: string) => Promise<void>;
  moveChatDb: (id: string, projectId: string | null) => Promise<void>;

  // Project Actions
  loadProjects: () => Promise<void>;

  // Assistant Actions
  loadAssistants: () => Promise<void>;

  // Prompt Actions
  loadPrompts: () => Promise<void>;

  // Knowledge Base Actions
  loadKnowledgebases: () => Promise<void>;

  // MCP Server Actions
  loadMcpServers: () => Promise<void>;
  loadPublicMcpServers: () => Promise<void>;

  // Chat Loading Actions
  loadChats: (
    rows: ChatRow[],
    messageRows: MessageRow[],
    attachmentRows?: AttachmentRow[],
  ) => void;
  createChatDb: (
    title?: string,
    projectId?: string,
    assistantId?: string,
  ) => Promise<string>;
  deleteChatDb: (chatId: string) => Promise<void>;
  upsertChat: (chat: Chat) => void;
  setKnowledgebase: (chatId: string, kbId: string | null) => Promise<void>;
};
