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
  /** Application-wide user settings (default models, global prompt). */
  userSettings: UserSettingsRow | null;
  /** All chats keyed by their ID. */
  chats: Record<string, Chat>;
  /** All configured MCP servers. */
  mcpServers: McpServer[];
  /** All publicly shared MCP servers from the community. */
  publicMcpServers: PublicMcpServer[];
  /** All transform agents. */
  transformAgents: TransformAgent[];
  /** All discovered MCP prompts (ephemeral). */
  mcpPrompts: DiscoveredPrompt[];

  loadTransformAgents: () => Promise<void>;
  /** Triggers discovery of prompts from all enabled MCP servers. */
  loadMcpPrompts: () => Promise<void>;

  // Chat Actions
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
  setCurrentLeafDb: (chatId: string, leafId: string) => Promise<void>;
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

  // User Settings Actions
  loadUserSettings: () => Promise<void>;

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
  setKnowledgebase: (chatId: string, kbId: string | null) => Promise<void>;
};
