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

