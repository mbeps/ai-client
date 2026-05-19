// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/lib/env", () => ({
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
    "from",
    "leftJoin",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn();
  }
  c.where = vi.fn();
  c.orderBy = vi.fn();
  c.returning = vi.fn();
  c.transaction = vi.fn();
  for (const m of [
    "select",
    "from",
    "leftJoin",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m].mockReturnValue(c);
  }
  c.where.mockReturnValue(c);
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

vi.mock("@/lib/actions/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { requireSession } from "@/lib/actions/require-session";
import { createChat } from "@/lib/actions/chats/create-chat";
import { listChats } from "@/lib/actions/chats/list-chats";
import { deleteChat } from "@/lib/actions/chats/delete-chat";
import { renameChat } from "@/lib/actions/chats/rename-chat";
import { moveChat } from "@/lib/actions/chats/move-chat";
import { getChat } from "@/lib/actions/chats/get-chat";
import { persistMessage } from "@/lib/actions/chats/persist-message";
import { updateCurrentLeaf } from "@/lib/actions/chats/update-current-leaf";

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
  chainable.from.mockReturnValue(chainable);
  chainable.leftJoin.mockReturnValue(chainable);
  chainable.limit.mockReturnValue(chainable);
  chainable.insert.mockReturnValue(chainable);
  chainable.values.mockReturnValue(chainable);
  chainable.update.mockReturnValue(chainable);
  chainable.set.mockReturnValue(chainable);
  chainable.delete.mockReturnValue(chainable);
  chainable.where.mockImplementation(() => chainable);
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
    expect(result).toEqual(CHAT_ROW);
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
    expect(result.title).toBe("New Chat");
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
        assistantId: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
      }),
    );
  });

  it("rejects with ZodError when title is empty", async () => {
    await expect(createChat("")).rejects.toThrow();
  });

  it("rejects with ZodError when projectId is not a UUID", async () => {
    await expect(createChat("My Chat", "not-a-uuid")).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(createChat("My Chat")).rejects.toThrow("Unauthorized");
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
    expect(result).toEqual([CHAT_ROW]);
    expect(chainable.select).toHaveBeenCalledOnce();
    expect(chainable.from).toHaveBeenCalledOnce();
  });

  it("returns an empty array when user has no chats", async () => {
    chainable.orderBy.mockResolvedValueOnce([]);
    const result = await listChats();
    expect(result).toEqual([]);
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(listChats()).rejects.toThrow("Unauthorized");
  });
});

// ── deleteChat ────────────────────────────────────────────────────────────────
describe("deleteChat", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("deletes the chat and resolves without error", async () => {
    chainable.returning.mockResolvedValueOnce([{ id: VALID_UUID }]);
    await expect(deleteChat(VALID_UUID)).resolves.toBeUndefined();
    expect(chainable.delete).toHaveBeenCalledOnce();
  });

  it("throws 'Not Found' when chat does not exist or is not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    await expect(deleteChat(VALID_UUID)).rejects.toThrow("Not Found");
  });

  it("throws ZodError when chatId is not a UUID", async () => {
    await expect(deleteChat("not-a-uuid")).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(deleteChat(VALID_UUID)).rejects.toThrow("Unauthorized");
  });
});

// ── renameChat ────────────────────────────────────────────────────────────────
describe("renameChat", () => {
  const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("updates the chat title and returns the updated row", async () => {
    const updated = { ...CHAT_ROW, title: "New Title" };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await renameChat(VALID_UUID, "New Title");
    expect(result).toEqual(updated);
    expect(chainable.update).toHaveBeenCalledOnce();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New Title" }),
    );
  });

  it("throws 'Chat not found or unauthorized' when row is missing", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    await expect(renameChat(VALID_UUID, "New Title")).rejects.toThrow(
      "Chat not found or unauthorized",
    );
  });

  it("throws ZodError when title is empty", async () => {
    await expect(renameChat(VALID_UUID, "")).rejects.toThrow();
  });

  it("throws ZodError when chatId is not a UUID", async () => {
    await expect(renameChat("bad-id", "New Title")).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(renameChat(VALID_UUID, "New Title")).rejects.toThrow(
      "Unauthorized",
    );
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
    expect(result).toEqual(updated);
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJ_UUID }),
    );
  });

  it("unbinds the chat from all projects when projectId is null", async () => {
    const updated = { ...CHAT_ROW, projectId: null };
    chainable.returning.mockResolvedValueOnce([updated]);
    const result = await moveChat(CHAT_UUID, null);
    expect(result.projectId).toBeNull();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: null }),
    );
  });

  it("throws 'Chat not found or access denied' when row is missing", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    await expect(moveChat(CHAT_UUID, PROJ_UUID)).rejects.toThrow(
      "Chat not found or access denied",
    );
  });

  it("throws ZodError when chatId is not a UUID", async () => {
    await expect(moveChat("bad-id", PROJ_UUID)).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(moveChat(CHAT_UUID, PROJ_UUID)).rejects.toThrow(
      "Unauthorized",
    );
  });
});

// ── getChat ───────────────────────────────────────────────────────────────────
describe("getChat", () => {
  const CHAT_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  it("returns the chat with messages and attachments", async () => {
    // getChat makes 3 db queries: select chat (where terminal), select messages
    // (where intermediate → orderBy terminal), select attachments (where terminal).
    // Track which call to `where` we are on to return the right value.
    let whereCallCount = 0;
    chainable.where.mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1)
        return Promise.resolve([
          { chat: CHAT_ROW, projectName: "My Project", assistantName: "Bot" },
        ]);
      if (whereCallCount === 3) return Promise.resolve([]);
      return chainable; // call 2: intermediate in messages query
    });
    chainable.orderBy.mockResolvedValueOnce([MESSAGE_ROW]);

    const result = await getChat(CHAT_UUID);
    expect(result).toMatchObject({
      id: CHAT_ROW.id,
      title: CHAT_ROW.title,
      messages: [MESSAGE_ROW],
      attachments: [],
      projectName: "My Project",
      assistantName: "Bot",
    });
  });

  it("returns empty attachments when there are no messages", async () => {
    // Only 2 queries run when messages are empty (skip attachments query)
    let whereCallCount = 0;
    chainable.where.mockImplementation(() => {
      whereCallCount++;
      if (whereCallCount === 1)
        return Promise.resolve([
          { chat: CHAT_ROW, projectName: null, assistantName: null },
        ]);
      return chainable; // call 2: intermediate in messages query
    });
    chainable.orderBy.mockResolvedValueOnce([]); // no messages → skip attachments

    const result = await getChat(CHAT_UUID);
    expect(result.messages).toEqual([]);
    expect(result.attachments).toEqual([]);
  });

  it("throws 'Not Found' when chat does not exist or is not owned", async () => {
    chainable.where.mockResolvedValueOnce([]); // no chat row
    await expect(getChat(CHAT_UUID)).rejects.toThrow("Not Found");
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(getChat(CHAT_UUID)).rejects.toThrow("Unauthorized");
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
    // First db call: verify chat ownership
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    // Second db call: insert message
    chainable.returning.mockResolvedValueOnce([MESSAGE_ROW]);

    const result = await persistMessage(CHAT_UUID, MSG_DATA);
    expect(result).toEqual(MESSAGE_ROW);
    expect(chainable.insert).toHaveBeenCalledOnce();
  });

  it("throws 'Not Found' when user does not own the chat", async () => {
    chainable.where.mockResolvedValueOnce([]); // no ownership match
    await expect(persistMessage(CHAT_UUID, MSG_DATA)).rejects.toThrow(
      "Not Found",
    );
  });

  it("throws ZodError when chatId is not a UUID", async () => {
    await expect(persistMessage("bad-id", MSG_DATA)).rejects.toThrow();
  });

  it("throws ZodError when role is invalid", async () => {
    await expect(
      persistMessage(CHAT_UUID, { ...MSG_DATA, role: "unknown" as "user" }),
    ).rejects.toThrow();
  });

  it("throws ZodError when content is empty", async () => {
    await expect(
      persistMessage(CHAT_UUID, { ...MSG_DATA, content: "" }),
    ).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(persistMessage(CHAT_UUID, MSG_DATA)).rejects.toThrow(
      "Unauthorized",
    );
  });
});

// ── updateCurrentLeaf ─────────────────────────────────────────────────────────
describe("updateCurrentLeaf", () => {
  const CHAT_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const LEAF_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d480";

  it("updates the leaf pointer and resolves without error", async () => {
    chainable.returning.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    await expect(
      updateCurrentLeaf(CHAT_UUID, LEAF_UUID),
    ).resolves.toBeUndefined();
    expect(chainable.update).toHaveBeenCalledOnce();
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ currentLeafId: LEAF_UUID }),
    );
  });

  it("throws 'Not Found' when chat is missing or not owned", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    await expect(updateCurrentLeaf(CHAT_UUID, LEAF_UUID)).rejects.toThrow(
      "Not Found",
    );
  });

  it("throws ZodError when chatId is not a UUID", async () => {
    await expect(updateCurrentLeaf("bad-id", LEAF_UUID)).rejects.toThrow();
  });

  it("throws ZodError when leafId is not a UUID", async () => {
    await expect(updateCurrentLeaf(CHAT_UUID, "bad-id")).rejects.toThrow();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(updateCurrentLeaf(CHAT_UUID, LEAF_UUID)).rejects.toThrow(
      "Unauthorized",
    );
  });
});
