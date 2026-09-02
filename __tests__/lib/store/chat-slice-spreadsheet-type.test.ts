import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Safety-net mocks ──────────────────────────────────────────────────────
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));
vi.mock("@/drizzle/db", () => ({ db: {} }));
vi.mock("@/lib/auth/auth", () => ({ auth: {} }));
vi.mock("@/lib/actions/chats/create-chat", () => ({ createChat: vi.fn() }));
vi.mock("@/lib/actions/chats/delete-chat", () => ({
  deleteChat: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/chats/rename-chat", () => ({ renameChat: vi.fn() }));
vi.mock("@/lib/actions/chats/move-chat", () => ({ moveChat: vi.fn() }));
vi.mock("@/lib/actions/chats/delete-message", () => ({
  deleteMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/chats/update-current-leaf", () => ({
  updateCurrentLeaf: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/chats/update-message-metadata", () => ({
  updateMessageMetadata: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/projects/list-projects", () => ({
  listProjects: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/list-assistants", () => ({
  listAssistants: vi.fn(),
}));
vi.mock("@/lib/actions/prompts/list-prompts", () => ({ listPrompts: vi.fn() }));
vi.mock("@/lib/actions/mcp-servers/list-mcp-servers", () => ({
  listMcpServers: vi.fn(),
}));

import { useAppStore } from "@/lib/store";
import type { AttachmentRow } from "@/types/attachment/attachment-row";
import type { ChatRow } from "@/types/chat/chat-row";
import type { MessageRow } from "@/types/message/message-row";

const RESET_STATE = {
  chats: {} as Record<string, never>,
  projects: [],
  assistants: [],
  prompts: [],
  knowledgebases: [],
  mcpServers: [],
};

const chatRow: ChatRow = {
  id: "chat-1",
  title: "Test Chat",
  userId: "user-1",
  projectId: null,
  assistantId: null,
  knowledgebaseId: null,
  currentLeafId: "msg-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const msgRow: MessageRow = {
  id: "msg-1",
  chatId: "chat-1",
  role: "user",
  content: "Hello",
  parentId: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeAttachmentRow(id: string, mimeType: string): AttachmentRow {
  return {
    id,
    messageId: "msg-1",
    transformRunId: null,
    userId: "user-1",
    name: "file",
    mimeType,
    size: 1024,
    key: `uploads/${id}`,
    extractedText: null,
    createdAt: new Date(),
  };
}

describe("loadChats — attachment type mapping (T7.2)", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
  });

  it("maps image MIME type to attachment type 'image'", () => {
    const att = makeAttachmentRow("att-img", "image/png");
    useAppStore.getState().loadChats([chatRow], [msgRow], [att]);
    const msg = useAppStore.getState().chats["chat-1"]?.messages["msg-1"];
    expect(msg?.attachments[0].type).toBe("image");
  });

  it("maps PDF MIME type to attachment type 'document'", () => {
    const att = makeAttachmentRow("att-pdf", "application/pdf");
    useAppStore.getState().loadChats([chatRow], [msgRow], [att]);
    const msg = useAppStore.getState().chats["chat-1"]?.messages["msg-1"];
    expect(msg?.attachments[0].type).toBe("document");
  });

  it("maps xlsx MIME type to attachment type 'spreadsheet'", () => {
    const att = makeAttachmentRow(
      "att-xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    useAppStore.getState().loadChats([chatRow], [msgRow], [att]);
    const msg = useAppStore.getState().chats["chat-1"]?.messages["msg-1"];
    expect(msg?.attachments[0].type).toBe("spreadsheet");
  });

  it("maps xls MIME type to attachment type 'spreadsheet'", () => {
    const att = makeAttachmentRow("att-xls", "application/vnd.ms-excel");
    useAppStore.getState().loadChats([chatRow], [msgRow], [att]);
    const msg = useAppStore.getState().chats["chat-1"]?.messages["msg-1"];
    expect(msg?.attachments[0].type).toBe("spreadsheet");
  });

  it("maps csv MIME type to attachment type 'spreadsheet'", () => {
    const att = makeAttachmentRow("att-csv", "text/csv");
    useAppStore.getState().loadChats([chatRow], [msgRow], [att]);
    const msg = useAppStore.getState().chats["chat-1"]?.messages["msg-1"];
    expect(msg?.attachments[0].type).toBe("spreadsheet");
  });
});
