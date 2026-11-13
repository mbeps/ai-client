// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

// ── chainable DB mock ─────────────────────────────────────────────────────────
const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "selectDistinct",
    "from",
    "leftJoin",
    "innerJoin",
    "limit",
    "insert",
    "values",
    "onConflictDoNothing",
    "onConflictDoUpdate",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn();
  }
  c.where = vi.fn().mockImplementation(() => c);
  c.orderBy = vi.fn().mockImplementation(() => c);
  c.limit = vi.fn().mockImplementation(() => c);
  c.offset = vi.fn().mockImplementation(() => c);
  c.$dynamic = vi.fn().mockImplementation(() => c);
  c.returning = vi.fn();
  c.transaction = vi.fn();

  for (const m of [
    "select",
    "selectDistinct",
    "from",
    "leftJoin",
    "innerJoin",
    "insert",
    "values",
    "onConflictDoNothing",
    "onConflictDoUpdate",
    "update",
    "set",
    "delete",
  ]) {
    c[m].mockImplementation(() => c);
  }
  c.orderBy.mockResolvedValue([]);
  c.returning.mockResolvedValue([]);
  c.transaction.mockImplementation(
    async (fn: (tx: typeof c) => Promise<unknown>) => fn(c),
  );
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

vi.mock("@/lib/chat/abort-chat-stream", () => ({
  abortChatStream: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/chat/chat-abort-registry", () => ({
  chatAbortRegistry: {
    has: vi.fn().mockReturnValue(false),
    abort: vi.fn().mockReturnValue(true),
    register: vi.fn(),
    delete: vi.fn(),
  },
}));

import { createChat } from "@/actions/chats/create-chat";
import { deleteChat } from "@/actions/chats/delete-chat";
import { deleteMessage } from "@/actions/chats/delete-message";
import { abortChatStream } from "@/lib/chat/abort-chat-stream";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import { getChat } from "@/actions/chats/get-chat";
import { listChats } from "@/actions/chats/list-chats";
import { moveChat } from "@/actions/chats/move-chat";
import { persistMessage } from "@/actions/chats/persist-message";
import { renameChat } from "@/actions/chats/rename-chat";
import { updateChatKnowledgebase } from "@/actions/chats/update-chat-knowledgebase";
import { updateCurrentLeaf } from "@/actions/chats/update-current-leaf";
import { requireSession } from "@/lib/auth/require-session";

const CHAT_ROW = {
  id: "chat-1",
  title: "My Chat",
  userId: "user-1",
  projectId: null,
  assistantId: null,
  currentLeafId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const MESSAGE_ROW = {
  id: "msg-1",
  chatId: "chat-1",
  role: "user" as const,
  content: "Hello",
  parentId: null,
  metadata: null,
  createdAt: new Date("2024-01-01"),
};

beforeEach(() => {
  vi.resetAllMocks();
  // Reset chainable methods to defaults
  chainable.select.mockReturnValue(chainable);
  chainable.selectDistinct.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  chainable.leftJoin.mockReturnValue(chainable);
  chainable.innerJoin.mockReturnValue(chainable);
  chainable.limit.mockReturnValue(chainable);
  chainable.insert.mockReturnValue(chainable);
  chainable.values.mockReturnValue(chainable);
  chainable.onConflictDoNothing.mockReturnValue(chainable);
  chainable.onConflictDoUpdate.mockReturnValue(chainable);
  chainable.update.mockReturnValue(chainable);
  chainable.set.mockReturnValue(chainable);
  chainable.delete.mockReturnValue(chainable);
  chainable.where.mockImplementation(() => chainable);
  chainable.$dynamic.mockImplementation(() => chainable);
  chainable.orderBy.mockResolvedValue([]);
  chainable.returning.mockResolvedValue([]);
  chainable.transaction.mockImplementation(
    async (fn: (tx: typeof chainable) => Promise<unknown>) => fn(chainable),
  );
  vi.mocked(requireSession).mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: {
      id: "session-1",
      token: "tok",
      userId: "user-1",
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
  } as Awaited<ReturnType<typeof requireSession>>);
});

// ── createChat ────────────────────────────────────────────────────────────────
describe("createChat", () => {
  it("inserts a chat and returns the new row", async () => {
    chainable.returning.mockResolvedValueOnce([CHAT_ROW]);
    const result = await createChat("My Chat");
    expect(result).toEqual({ ok: true, value: CHAT_ROW });
    expect(chainable.insert).toHaveBeenCalledOnce();
    expect(chainable.values).toHaveBeenCalledOnce();
    expect(chainable.returning).toHaveBeenCalledOnce();
  });

  it("defaults title to 'New Chat' when not provided", async () => {
    chainable.returning.mockResolvedValueOnce([
      { ...CHAT_ROW, title: "New Chat" },
    ]);
    const result = await createChat();
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New Chat" }),
    );
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ title: "New Chat" }),
    });
  });

  it("binds projectId and assistantId when provided", async () => {
    chainable.returning.mockResolvedValueOnce([
      { ...CHAT_ROW, projectId: "proj-1", assistantId: "asst-1" },
    ]);
    await createChat(
      "My Chat",
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "f47ac10b-58cc-4372-a567-0e02b2c3d480",
    );
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        agentId: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
      }),
    );
  });

  it("returns INVALID_INPUT when title is empty", async () => {
    const res = await createChat("");
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns INVALID_INPUT when projectId is not a UUID", async () => {
    const res = await createChat("My Chat", "not-a-uuid");
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await createChat("My Chat");
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });

  it("attaches the authenticated user id to the new row", async () => {
    chainable.returning.mockResolvedValueOnce([CHAT_ROW]);
    await createChat("My Chat");
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
  });
});

// ── listChats ─────────────────────────────────────────────────────────────────
describe("listChats", () => {
  it("returns all chats for the user", async () => {
    chainable.orderBy.mockResolvedValueOnce([CHAT_ROW]);
    const result = await listChats();
    expect(result).toEqual({ ok: true, value: [CHAT_ROW] });
    expect(chainable.select).toHaveBeenCalledOnce();
    expect(chainable.from).toHaveBeenCalledOnce();
  });

  it("returns an empty array when user has no chats", async () => {
    chainable.orderBy.mockResolvedValueOnce([]);
    const result = await listChats();
    expect(result).toEqual({ ok: true, value: [] });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await listChats();
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});

// ── deleteChat ────────────────────────────────────────────────────────────────
describe("deleteChat", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("deletes the chat and resolves without error", async () => {
    chainable.where
      .mockResolvedValueOnce([{ key: "k1" }])
      .mockImplementationOnce(() => ({
        ...chainable,
        returning: chainable.returning,
      }));
    chainable.returning.mockResolvedValueOnce([{ id: VALID_UUID }]);
    const res = await deleteChat(VALID_UUID);
    expect(res).toEqual({ ok: true, value: undefined });
    expect(chainable.delete).toHaveBeenCalledOnce();
    expect(abortChatStream).toHaveBeenCalledWith(VALID_UUID, "user-1");
  });

  it("returns NOT_FOUND when chat does not exist or is not owned", async () => {
    chainable.where.mockResolvedValueOnce([]).mockImplementationOnce(() => ({
      ...chainable,
      returning: chainable.returning,
    }));
    chainable.returning.mockResolvedValueOnce([]);
    const res = await deleteChat(VALID_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
    expect(abortChatStream).not.toHaveBeenCalled();
  });

  it("returns INVALID_INPUT when chatId is not a UUID", async () => {
    const res = await deleteChat("not-a-uuid");
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await deleteChat(VALID_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});

// ── renameChat ────────────────────────────────────────────────────────────────
describe("renameChat", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("updates the chat title and returns the updated row", async () => {
    const updated = { ...CHAT_ROW, title: "New Title" };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await renameChat(VALID_UUID, "New Title");
    expect(result).toEqual({ ok: true, value: updated });
    expect(chainable.update).toHaveBeenCalledOnce();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New Title" }),
    );
  });

  it("returns NOT_FOUND when row is missing", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    const res = await renameChat(VALID_UUID, "New Title");
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("returns INVALID_INPUT when title is empty", async () => {
    const res = await renameChat(VALID_UUID, "");
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns INVALID_INPUT when chatId is not a UUID", async () => {
    const res = await renameChat("bad-id", "New Title");
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await renameChat(VALID_UUID, "New Title");
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});

// ── moveChat ──────────────────────────────────────────────────────────────────
describe("moveChat", () => {
  const CHAT_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const PROJ_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d480";

  it("moves the chat to a project and returns the updated row", async () => {
    const updated = { ...CHAT_ROW, projectId: PROJ_UUID };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await moveChat(CHAT_UUID, PROJ_UUID);
    expect(result).toEqual({ ok: true, value: updated });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJ_UUID }),
    );
  });

  it("unbinds the chat from all projects when projectId is null", async () => {
    const updated = { ...CHAT_ROW, projectId: null };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await moveChat(CHAT_UUID, null);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ projectId: null }),
    });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: null }),
    );
  });

  it("returns NOT_FOUND when row is missing", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    const res = await moveChat(CHAT_UUID, PROJ_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("returns INVALID_INPUT when chatId is not a UUID", async () => {
    const res = await moveChat("bad-id", PROJ_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await moveChat(CHAT_UUID, PROJ_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});

// ── getChat ───────────────────────────────────────────────────────────────────
describe("getChat", () => {
  const CHAT_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("returns the chat with messages and attachments", async () => {
    let whereCallCount = 0;
    chainable.where.mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1)
        return Promise.resolve([
          { chat: CHAT_ROW, projectName: "My Project", agentName: "Bot" },
        ]);
      if (whereCallCount === 3) return Promise.resolve([]);
      return chainable;
    });
    chainable.orderBy.mockResolvedValueOnce([MESSAGE_ROW]);

    const result = await getChat(CHAT_UUID);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        id: CHAT_ROW.id,
        title: CHAT_ROW.title,
        messages: [MESSAGE_ROW],
        attachments: [],
        projectName: "My Project",
        agentName: "Bot",
        assistantName: "Bot",
      }),
    });
  });

  it("resolves built-in agent name when chat.agentId is a builtin:* ID", async () => {
    let whereCallCount = 0;
    chainable.where.mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1)
        return Promise.resolve([
          {
            chat: { ...CHAT_ROW, agentId: "builtin:researcher" },
            projectName: null,
            agentName: null,
          },
        ]);
      return chainable;
    });
    chainable.orderBy.mockResolvedValueOnce([]);

    const result = await getChat(CHAT_UUID);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        agentName: "Researcher",
        assistantName: "Researcher",
      }),
    });
  });

  it("returns empty attachments when there are no messages", async () => {
    let whereCallCount = 0;
    chainable.where.mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1)
        return Promise.resolve([
          { chat: CHAT_ROW, projectName: null, agentName: null },
        ]);
      return chainable;
    });
    chainable.orderBy.mockResolvedValueOnce([]);

    const result = await getChat(CHAT_UUID);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        messages: [],
        attachments: [],
      }),
    });
  });

  it("returns NOT_FOUND when chat does not exist or is not owned", async () => {
    chainable.where.mockResolvedValueOnce([]);
    const res = await getChat(CHAT_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await getChat(CHAT_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});

// ── persistMessage ────────────────────────────────────────────────────────────
describe("persistMessage", () => {
  const CHAT_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const MSG_DATA = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d481",
    role: "user" as const,
    content: "Hello world",
    parentId: null,
  };

  it("persists the message and returns the row", async () => {
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    chainable.returning.mockResolvedValueOnce([MESSAGE_ROW]);

    const result = await persistMessage(CHAT_UUID, MSG_DATA);
    expect(result).toEqual({ ok: true, value: MESSAGE_ROW });
    expect(chainable.insert).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND when user does not own the chat", async () => {
    chainable.where.mockResolvedValueOnce([]);
    const res = await persistMessage(CHAT_UUID, MSG_DATA);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("returns INVALID_INPUT when chatId is not a UUID", async () => {
    const res = await persistMessage("bad-id", MSG_DATA);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns INVALID_INPUT when role is invalid", async () => {
    const res = await persistMessage(CHAT_UUID, {
      ...MSG_DATA,
      role: "unknown" as "user",
    });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns INVALID_INPUT when content is empty", async () => {
    const res = await persistMessage(CHAT_UUID, {
      ...MSG_DATA,
      content: "",
    });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await persistMessage(CHAT_UUID, MSG_DATA);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});

// ── updateCurrentLeaf ─────────────────────────────────────────────────────────
describe("updateCurrentLeaf", () => {
  const CHAT_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const LEAF_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d480";

  it("updates the leaf pointer and resolves without error", async () => {
    chainable.returning.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    const res = await updateCurrentLeaf(CHAT_UUID, LEAF_UUID);
    expect(res).toEqual({ ok: true, value: undefined });
    expect(chainable.update).toHaveBeenCalledOnce();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ currentLeafId: LEAF_UUID }),
    );
  });

  it("returns NOT_FOUND when chat is missing or not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    const res = await updateCurrentLeaf(CHAT_UUID, LEAF_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("returns INVALID_INPUT when chatId is not a UUID", async () => {
    const res = await updateCurrentLeaf("bad-id", LEAF_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns INVALID_INPUT when leafId is not a UUID", async () => {
    const res = await updateCurrentLeaf(CHAT_UUID, "bad-id");
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("returns UNAUTHORIZED when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await updateCurrentLeaf(CHAT_UUID, LEAF_UUID);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
    });
  });
});

// ── updateChatKnowledgebase ──────────────────────────────────────────────────
describe("updateChatKnowledgebase", () => {
  const CHAT_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const KB_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d480";

  it("updates knowledgebaseId when KB is owned by user", async () => {
    chainable.where
      .mockResolvedValueOnce([{ id: KB_UUID }])
      .mockImplementationOnce(() => chainable);
    chainable.returning.mockResolvedValueOnce([{ id: CHAT_UUID }]);

    const res = await updateChatKnowledgebase({
      chatId: CHAT_UUID,
      knowledgebaseId: KB_UUID,
    });
    expect(res).toEqual({ ok: true, value: undefined });
  });

  it("returns NOT_FOUND when knowledgebase is not owned by user", async () => {
    chainable.where.mockResolvedValueOnce([]);

    const res = await updateChatKnowledgebase({
      chatId: CHAT_UUID,
      knowledgebaseId: KB_UUID,
    });
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("allows setting knowledgebaseId to null without checking KB table", async () => {
    chainable.returning.mockResolvedValueOnce([{ id: CHAT_UUID }]);

    const res = await updateChatKnowledgebase({
      chatId: CHAT_UUID,
      knowledgebaseId: null,
    });
    expect(res).toEqual({ ok: true, value: undefined });
  });
});

// ── deleteMessage ─────────────────────────────────────────────────────────────
describe("deleteMessage", () => {
  const CHAT_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const MSG_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d481";
  const LEAF_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d482";

  it("aborts active streams via abortChatStream when a stream is active", async () => {
    vi.mocked(chatAbortRegistry.has).mockReturnValueOnce(true);
    chainable.where.mockResolvedValueOnce([
      { id: CHAT_UUID, currentLeafId: MSG_UUID },
    ]);
    chainable.where.mockResolvedValueOnce([{ id: MSG_UUID, parentId: null }]);
    chainable.where.mockResolvedValueOnce([]);
    chainable.where.mockResolvedValue([]);

    const res = await deleteMessage(CHAT_UUID, MSG_UUID, LEAF_UUID);
    expect(res).toEqual({ ok: true, value: undefined });
    expect(abortChatStream).toHaveBeenCalledWith(CHAT_UUID, "user-1");
  });

  it("does not abort stream when no stream is active", async () => {
    vi.mocked(chatAbortRegistry.has).mockReturnValueOnce(false);
    chainable.where.mockResolvedValueOnce([
      { id: CHAT_UUID, currentLeafId: null },
    ]);
    chainable.where.mockResolvedValueOnce([{ id: MSG_UUID, parentId: null }]);
    chainable.where.mockResolvedValueOnce([]);
    chainable.where.mockResolvedValue([]);

    const res = await deleteMessage(CHAT_UUID, MSG_UUID, null);
    expect(res).toEqual({ ok: true, value: undefined });
    expect(abortChatStream).not.toHaveBeenCalled();
  });
});
