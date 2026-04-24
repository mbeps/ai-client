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
 * Shape of the global Zustand store, combining all entity collections and mutation actions.
 */
export type AppState = {
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
  toggleProjectPin: (id: string) => void;
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

  // DB-backed actions
  renameChatDb: (id: string, title: string) => Promise<void>;
  moveChatDb: (id: string, projectId: string | null) => Promise<void>;
  renameProjectDb: (id: string, name: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  loadProjectRows: (rows: ProjectRow[]) => void;
  createProjectDb: (data: {
    name: string;
    description?: string;
  }) => Promise<string>;
  updateProjectDb: (
    id: string,
    data: { name?: string; description?: string; globalPrompt?: string },
  ) => Promise<void>;
  deleteProjectDb: (id: string) => Promise<void>;
  toggleProjectPinDb: (id: string) => Promise<void>;
  renameAssistantDb: (id: string, name: string) => Promise<void>;
  loadAssistants: () => Promise<void>;
  loadAssistantRows: (rows: AssistantRow[]) => void;
  createAssistantDb: (data: {
    name: string;
    description?: string;
    prompt?: string;
  }) => Promise<string>;
  updateAssistantDb: (
    id: string,
    data: { name?: string; description?: string; prompt?: string },
  ) => Promise<void>;
  deleteAssistantDb: (id: string) => Promise<void>;

  loadPrompts: () => Promise<void>;
  createPromptDb: (data: {
    title: string;
    shortcut: string;
    content: string;
  }) => Promise<string>;
  updatePromptDb: (
    id: string,
    data: { title?: string; shortcut?: string; content?: string },
  ) => Promise<void>;
  deletePromptDb: (id: string) => Promise<void>;

  renameKnowledgebaseDb: (id: string, name: string) => Promise<void>;

  loadMcpServers: () => Promise<void>;
  addMcpServer: (data: CreateMcpServer) => Promise<void>;
  removeMcpServer: (id: string) => Promise<void>;
  renameMcpServer: (id: string, name: string) => Promise<void>;
  toggleMcpServer: (id: string) => Promise<void>;
  updateMcpServer: (id: string, data: UpdateMcpServer) => Promise<void>;

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
};
