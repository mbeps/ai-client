import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "@/lib/store";

// ─── Safety-net mocks (same pattern as chat-slice.test.ts) ─────────────────
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

// Entity slice stubs
vi.mock("@/lib/actions/chats/create-chat", () => ({ createChat: vi.fn() }));
vi.mock("@/lib/actions/chats/delete-chat", () => ({ deleteChat: vi.fn() }));
vi.mock("@/lib/actions/chats/rename-chat", () => ({ renameChat: vi.fn() }));
vi.mock("@/lib/actions/chats/move-chat", () => ({ moveChat: vi.fn() }));
vi.mock("@/lib/actions/chats/delete-message", () => ({
  deleteMessage: vi.fn(),
}));
vi.mock("@/lib/actions/chats/update-current-leaf", () => ({
  updateCurrentLeaf: vi.fn(),
}));
vi.mock("@/lib/actions/chats/update-message-metadata", () => ({
  updateMessageMetadata: vi.fn(),
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

// ─── Helpers ───────────────────────────────────────────────────────────────
const RESET_STATE = {
  chats: {},
  projects: [],
  assistants: [],
  prompts: [],
  knowledgebases: [],
  mcpServers: [],
};

const NOW = new Date().toISOString();

function makeChatRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: "Chat",
    projectId: null,
    assistantId: null,
    currentLeafId: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeMessageRow(
  id: string,
  chatId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    chatId,
    role: "user" as const,
    content: "Hello",
    parentId: null,
    metadata: null,
    createdAt: NOW,
    ...overrides,
  };
}

function makeAttachmentRow(
  id: string,
  messageId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    messageId,
    name: "doc.pdf",
    mimeType: "application/pdf",
    size: 1024,
    key: "uploads/doc.pdf",
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("ChatSlice — loadChats extractedText mapping", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  it("maps extractedText from attachment rows onto store attachments", () => {
    useAppStore.getState().loadChats(
      [makeChatRow("c1")],
      [makeMessageRow("msg-1", "c1")],
      [
        makeAttachmentRow("att-1", "msg-1", {
          extractedText: "Extracted PDF content here",
        }),
      ],
    );

    const atts =
      useAppStore.getState().chats["c1"].messages["msg-1"].attachments;
    expect(atts).toHaveLength(1);
    expect(atts[0].extractedText).toBe("Extracted PDF content here");
  });

  it("sets extractedText to undefined when attachment row has null extractedText", () => {
    useAppStore.getState().loadChats(
      [makeChatRow("c1")],
      [makeMessageRow("msg-1", "c1")],
      [
        makeAttachmentRow("att-1", "msg-1", {
          extractedText: null,
        }),
      ],
    );

    const atts =
      useAppStore.getState().chats["c1"].messages["msg-1"].attachments;
    expect(atts).toHaveLength(1);
    expect(atts[0].extractedText).toBeUndefined();
  });

  it("maps extractedText for multiple attachments on the same message", () => {
    useAppStore.getState().loadChats(
      [makeChatRow("c1")],
      [makeMessageRow("msg-1", "c1")],
      [
        makeAttachmentRow("att-1", "msg-1", {
          name: "doc1.pdf",
          extractedText: "First doc content",
        }),
        makeAttachmentRow("att-2", "msg-1", {
          name: "doc2.pdf",
          extractedText: "Second doc content",
        }),
      ],
    );

    const atts =
      useAppStore.getState().chats["c1"].messages["msg-1"].attachments;
    expect(atts).toHaveLength(2);
    expect(atts[0].extractedText).toBe("First doc content");
    expect(atts[1].extractedText).toBe("Second doc content");
  });

  it("maps extractedText for attachments across different messages", () => {
    useAppStore.getState().loadChats(
      [makeChatRow("c1")],
      [
        makeMessageRow("msg-1", "c1"),
        makeMessageRow("msg-2", "c1", {
          role: "assistant",
          content: "Response",
          parentId: "msg-1",
        }),
      ],
      [
        makeAttachmentRow("att-1", "msg-1", {
          extractedText: "User doc text",
        }),
        makeAttachmentRow("att-2", "msg-2", {
          extractedText: "Assistant doc text",
        }),
      ],
    );

    const msgs = useAppStore.getState().chats["c1"].messages;
    expect(msgs["msg-1"].attachments[0].extractedText).toBe("User doc text");
    expect(msgs["msg-2"].attachments[0].extractedText).toBe(
      "Assistant doc text",
    );
  });

  it("keeps existing attachment fields intact when extractedText is mapped", () => {
    useAppStore.getState().loadChats(
      [makeChatRow("c1")],
      [makeMessageRow("msg-1", "c1")],
      [
        {
          id: "att-1",
          messageId: "msg-1",
          name: "report.pdf",
          mimeType: "application/pdf",
          size: 5000,
          key: "uploads/report.pdf",
          extractedText: "Extracted",
        },
      ],
    );

    const att =
      useAppStore.getState().chats["c1"].messages["msg-1"].attachments[0];
    expect(att.id).toBe("att-1");
    expect(att.name).toBe("report.pdf");
    expect(att.mimeType).toBe("application/pdf");
    expect(att.sizeBytes).toBe(5000);
    expect(att.key).toBe("uploads/report.pdf");
    expect(att.type).toBe("document");
    expect(att.extractedText).toBe("Extracted");
  });
});
