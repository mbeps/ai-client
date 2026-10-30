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

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "onConflictDoUpdate",
    "returning",
    "update",
    "set",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistMessage } from "@/actions/chats/persist-message";

const CHAT_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const MSG_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d481";

describe("persistMessage - Conflict & Model Preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.onConflictDoUpdate.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
  });

  it("does not overwrite existing non-empty model when incoming metadata has empty model", async () => {
    // 1. Chat ownership check
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    // 2. Existing message check - message already exists with model 'gpt-4o'
    chainable.where.mockResolvedValueOnce([
      {
        id: MSG_UUID,
        metadata: JSON.stringify({
          model: "gpt-4o",
          reasoning: "previous thought",
          toolCalls: [{ toolCallId: "tc-1", toolName: "search", serverName: "mcp-server" }],
        }),
      },
    ]);
    // 3. Insert returning
    chainable.returning.mockResolvedValueOnce([
      {
        id: MSG_UUID,
        chatId: CHAT_UUID,
        role: "assistant",
        content: "partial content",
        metadata: JSON.stringify({
          model: "gpt-4o",
          reasoning: "new thought",
        }),
      },
    ]);

    const incomingMetadata = JSON.stringify({
      model: "", // empty model from rejoined stop
      reasoning: "new thought",
      stopped: true,
    });

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "partial content",
      parentId: null,
      metadata: incomingMetadata,
    });

    // Verify onConflictDoUpdate set does not set model to ""
    expect(chainable.onConflictDoUpdate).toHaveBeenCalled();
    const updateArgs = chainable.onConflictDoUpdate.mock.calls[0][0];
    const updatedMeta = JSON.parse(updateArgs.set.metadata);
    expect(updatedMeta.model).toBe("gpt-4o");
  });

  it("allows empty content for assistant messages when stopped during tool calling", async () => {
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    chainable.where.mockResolvedValueOnce([]); // no existing message
    chainable.returning.mockResolvedValueOnce([
      {
        id: MSG_UUID,
        chatId: CHAT_UUID,
        role: "assistant",
        content: "",
        metadata: JSON.stringify({ stopped: true }),
      },
    ]);

    const result = await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "",
      parentId: null,
      metadata: JSON.stringify({ stopped: true }),
    });

    expect(result).toBeDefined();
  });
});

describe("persistMessage - metadata merge branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.onConflictDoUpdate.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
  });

  function stubDb(returningRow: Record<string, unknown>) {
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    chainable.where.mockResolvedValueOnce([]);
    chainable.returning.mockResolvedValueOnce([returningRow]);
  }

  it("keeps incoming metadata when no existing message (existing null)", async () => {
    stubDb({ id: MSG_UUID });
    const metadata = JSON.stringify({ model: "m1" });

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata,
    });

    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ metadata }),
    );
  });

  it("returns null metadata when both existing and incoming are null", async () => {
    stubDb({ id: MSG_UUID });

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: null,
    });

    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: null }),
    );
  });

  it("keeps existing metadata when incoming is null", async () => {
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    chainable.where.mockResolvedValueOnce([
      { id: MSG_UUID, metadata: JSON.stringify({ model: "old" }) },
    ]);
    chainable.returning.mockResolvedValueOnce([{ id: MSG_UUID }]);

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: null,
    });

    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: JSON.stringify({ model: "old" }) }),
    );
  });

  it("returns incoming metadata raw when existing metadata is not valid JSON", async () => {
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    chainable.where.mockResolvedValueOnce([
      { id: MSG_UUID, metadata: "not-json{{" },
    ]);
    chainable.returning.mockResolvedValueOnce([{ id: MSG_UUID }]);
    const incoming = JSON.stringify({ model: "new" });

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: incoming,
    });

    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: incoming }),
    );
  });

  it("preserves existing model when incoming model is falsy", async () => {
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    chainable.where.mockResolvedValueOnce([
      { id: MSG_UUID, metadata: JSON.stringify({ model: "gpt-4o" }) },
    ]);
    chainable.returning.mockResolvedValueOnce([{ id: MSG_UUID }]);

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: JSON.stringify({ model: "" }),
    });

    const saved = JSON.parse(
      (chainable.values.mock.calls[0][0] as { metadata: string }).metadata,
    );
    expect(saved.model).toBe("gpt-4o");
  });

  it("does not overwrite incoming model when it is present", async () => {
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    chainable.where.mockResolvedValueOnce([
      { id: MSG_UUID, metadata: JSON.stringify({ model: "old" }) },
    ]);
    chainable.returning.mockResolvedValueOnce([{ id: MSG_UUID }]);

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: JSON.stringify({ model: "new" }),
    });

    const saved = JSON.parse(
      (chainable.values.mock.calls[0][0] as { metadata: string }).metadata,
    );
    expect(saved.model).toBe("new");
  });
});

describe("persistMessage - preserveServerNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.onConflictDoUpdate.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
  });

  function stubDb(existingMeta: unknown, incomingMeta: unknown) {
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    chainable.where.mockResolvedValueOnce([
      { id: MSG_UUID, metadata: JSON.stringify(existingMeta) },
    ]);
    chainable.returning.mockResolvedValueOnce([{ id: MSG_UUID }]);
    return incomingMeta;
  }

  function savedMetadata(): Record<string, unknown> {
    return JSON.parse(
      (chainable.values.mock.calls[0][0] as { metadata: string }).metadata,
    );
  }

  it("copies serverName from existing toolCalls into incoming items missing it", async () => {
    stubDb(
      {
        toolCalls: [
          { toolCallId: "tc-1", serverName: "srv-a" },
          { toolCallId: "tc-2", serverName: "srv-b" },
        ],
        toolResults: [{ toolCallId: "tc-1", serverName: "srv-a" }],
      },
      {
        toolCalls: [
          { toolCallId: "tc-1" },
          { toolCallId: "tc-2", serverName: "kept" },
          { toolCallId: "tc-3" },
          "not-an-object",
          { toolCallId: 42 },
        ],
        toolResults: [{ toolCallId: "tc-1" }],
      },
    );

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: JSON.stringify({
        toolCalls: [
          { toolCallId: "tc-1" },
          { toolCallId: "tc-2", serverName: "kept" },
          { toolCallId: "tc-3" },
          "not-an-object",
          { toolCallId: 42 },
        ],
        toolResults: [{ toolCallId: "tc-1" }],
      }),
    });

    const saved = savedMetadata();
    expect(saved.toolCalls).toEqual([
      { toolCallId: "tc-1", serverName: "srv-a" },
      { toolCallId: "tc-2", serverName: "kept" },
      { toolCallId: "tc-3" },
      "not-an-object",
      { toolCallId: 42 },
    ]);
    expect(saved.toolResults).toEqual([
      { toolCallId: "tc-1", serverName: "srv-a" },
    ]);
  });

  it("skips serverName copy when existing item has no serverName", async () => {
    stubDb(
      { toolCalls: [{ toolCallId: "tc-1" }] },
      { toolCalls: [{ toolCallId: "tc-1" }] },
    );

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: JSON.stringify({ toolCalls: [{ toolCallId: "tc-1" }] }),
    });

    expect(savedMetadata().toolCalls).toEqual([{ toolCallId: "tc-1" }]);
  });

  it("skips preserveServerNames when existing toolCalls is not an array", async () => {
    stubDb({ toolCalls: "nope" }, { toolCalls: [{ toolCallId: "tc-1" }] });

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: JSON.stringify({ toolCalls: [{ toolCallId: "tc-1" }] }),
    });

    expect(savedMetadata().toolCalls).toEqual([{ toolCallId: "tc-1" }]);
  });

  it("skips preserveServerNames when incoming toolResults is not an array", async () => {
    stubDb(
      { toolResults: [{ toolCallId: "tc-1", serverName: "srv" }] },
      { toolResults: "nope" },
    );

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: JSON.stringify({ toolResults: "nope" }),
    });

    expect(savedMetadata().toolResults).toBe("nope");
  });

  it("handles null metadata on existing row without crashing", async () => {
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    chainable.where.mockResolvedValueOnce([{ id: MSG_UUID, metadata: null }]);
    chainable.returning.mockResolvedValueOnce([{ id: MSG_UUID }]);
    const incoming = JSON.stringify({ model: "m" });

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: incoming,
    });

    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: incoming }),
    );
  });

  it("throws Not Found when chat does not exist or is not owned", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(
      persistMessage(CHAT_UUID, {
        id: MSG_UUID,
        role: "assistant",
        content: "hi",
        parentId: null,
        metadata: null,
      }),
    ).rejects.toThrow("Not Found");
    expect(chainable.insert).not.toHaveBeenCalled();
  });

  it("treats non-array existing rows as no existing message", async () => {
    chainable.where.mockResolvedValueOnce([{ id: CHAT_UUID }]);
    chainable.where.mockResolvedValueOnce(undefined as unknown as never[]);
    chainable.returning.mockResolvedValueOnce([{ id: MSG_UUID }]);
    const incoming = JSON.stringify({ model: "m" });

    await persistMessage(CHAT_UUID, {
      id: MSG_UUID,
      role: "assistant",
      content: "hi",
      parentId: null,
      metadata: incoming,
    });

    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: incoming }),
    );
  });
});

