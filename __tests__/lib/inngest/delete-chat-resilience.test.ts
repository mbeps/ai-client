import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Environment Mocking ──────────────────────────────────────────────────────
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
    CHAT_MAX_STEPS: 5,
  },
}));

// ── Database Chain Mocking ───────────────────────────────────────────────────
const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "selectDistinct",
    "from",
    "where",
    "innerJoin",
    "leftJoin",
    "delete",
    "insert",
    "values",
    "update",
    "set",
    "returning",
    "orderBy",
    "limit",
    "onConflictDoNothing",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

// ── Inngest & Realtime Mocking ───────────────────────────────────────────────
const mockInngestSend = vi.hoisted(() => vi.fn().mockResolvedValue({ ids: ["evt-1"] }));
const mockRealtimePublish = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: mockInngestSend,
    createFunction: vi.fn((_config, handler) => handler),
    realtime: { publish: mockRealtimePublish },
  },
}));

// ── Abort Registry Mocking ───────────────────────────────────────────────────
const mockAbortRegistry = vi.hoisted(() => ({
  register: vi.fn(),
  abort: vi.fn().mockReturnValue(true),
  delete: vi.fn(),
}));

vi.mock("@/lib/chat/chat-abort-registry", () => ({
  chatAbortRegistry: mockAbortRegistry,
}));

// ── Auth Mocking ─────────────────────────────────────────────────────────────
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-test-123", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

vi.mock("@/lib/storage/sweep-orphaned-attachment-keys", () => ({
  sweepOrphanedAttachmentKeys: vi.fn().mockResolvedValue(undefined),
}));

// ── AI SDK & Chat Dependencies ──────────────────────────────────────────────
const mockStreamText = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({
  streamText: mockStreamText,
  isStepCount: vi.fn(() => ({ isStepCount: true })),
  tool: vi.fn((def) => def),
}));

vi.mock("@/lib/user/get-user-settings-by-id", () => ({
  getUserSettingsByUserId: vi.fn().mockResolvedValue(null),
}));

const mockResolvedProvider = vi.hoisted(() => ({
  modelId: "mock-model",
  modelRow: { capVision: false, capTools: false },
  sdkProvider: { chat: vi.fn() },
}));

vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: vi.fn().mockResolvedValue(mockResolvedProvider),
}));

vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: vi.fn().mockResolvedValue(mockResolvedProvider),
}));

const mockLoadChatContext = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/load-chat-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chat/load-chat-context")>();
  return {
    ...actual,
    loadChatContext: mockLoadChatContext,
  };
});

vi.mock("@/lib/chat/load-thread-from-db", () => ({
  loadThreadFromDb: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/chat/register-mcp-tools", () => ({
  registerMcpTools: vi.fn().mockResolvedValue({ mcpTools: {}, mcpCleanup: vi.fn() }),
}));

// ── System Imports ───────────────────────────────────────────────────────────
import { deleteChat } from "@/actions/chats/delete-chat";
import { getChat } from "@/actions/chats/get-chat";
import { ChatNotFoundError } from "@/lib/chat/load-chat-context";
import { persistAssistantResponse } from "@/lib/chat/persist-response";
import { generateChatResponse } from "@/lib/inngest/functions/chat-response";

const TEST_CHAT_ID = "5d0ab1ab-7b10-4539-ba94-fdcab5a3fe76";
const TEST_USER_ID = "user-test-123";

describe("Delete Chat While Streaming End-to-End Resilience Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadChatContext.mockResolvedValue({
      chatRow: { id: TEST_CHAT_ID, projectId: null, assistantId: null, knowledgebaseId: null },
      projectRow: null,
      activeKbId: null,
      activeKbIds: [],
      kbIsReady: false,
      assistantRow: null,
      skillMode: "dynamic",
      skillIds: [],
      servers: [],
      availableSkills: [],
      selectedSkills: [],
    });
  });

  it("1. deleteChat verifies ownership atomically and aborts stream upon deletion", async () => {
    chainable.where.mockReturnValueOnce([]); // keys query
    chainable.returning.mockReturnValueOnce([{ id: TEST_CHAT_ID }]); // delete chat query

    await deleteChat(TEST_CHAT_ID);

    expect(chainable.delete).toHaveBeenCalled();
    expect(mockAbortRegistry.abort).toHaveBeenCalledWith(TEST_CHAT_ID);
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "chat/response.cancel",
        data: { chatId: TEST_CHAT_ID, userId: TEST_USER_ID },
      }),
    );
  });

  it("2. deleteChat throws 'Not Found' and does not abort stream on unauthorized or missing chat", async () => {
    chainable.where.mockReturnValueOnce([]);
    chainable.returning.mockReturnValueOnce([]); // no chat deleted

    await expect(deleteChat(TEST_CHAT_ID)).rejects.toThrow("Not Found");

    expect(mockAbortRegistry.abort).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalledWith(
      expect.objectContaining({
        name: "chat/response.cancel",
      }),
    );
  });

  it("3. persistAssistantResponse catches PostgreSQL 23503 and returns false", async () => {
    const fkViolationError = new Error(
      `Failed query: insert into "message" ("id", "chat_id", "role", "content", "parent_id", "metadata", "created_at", "updated_at") values ($1, $2, $3, $4, $5, $6, default, default) on conflict do nothing returning "id"`,
    );
    (fkViolationError as any).code = "23503";
    (fkViolationError as any).cause = new Error(
      `insert or update on table "message" violates foreign key constraint "message_chat_id_chat_id_fk"`,
    );

    chainable.limit.mockResolvedValueOnce([]);
    chainable.returning.mockRejectedValueOnce(fkViolationError);

    const result = await persistAssistantResponse({
      chatId: TEST_CHAT_ID,
      assistantMessageId: "asst-msg-1",
      content: "Completed response",
      parentId: "user-msg-1",
      metadata: "{}",
    });

    expect(result).toBe(false);
  });

  it("4. generateChatResponse skips finish emit and completes cleanly when persistAssistantResponse returns false", async () => {
    const controller = new AbortController();
    mockAbortRegistry.register.mockReturnValue({
      controller,
      release: vi.fn(),
    });

    mockStreamText.mockReturnValue({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Streaming answer" };
      })(),
      finishReason: Promise.resolve("stop"),
      usage: Promise.resolve({ promptTokens: 10, completionTokens: 5 }),
    });

    // Simulate concurrent deletion during persistence
    const fkViolationError = new Error(
      `insert violates foreign key constraint "message_chat_id_chat_id_fk"`,
    );
    (fkViolationError as any).code = "23503";

    chainable.limit.mockResolvedValueOnce([]);
    chainable.returning.mockRejectedValueOnce(fkViolationError);

    const fnHandler = generateChatResponse as unknown as (ctx: any) => Promise<any>;

    await expect(
      fnHandler({
        event: {
          data: {
            chatId: TEST_CHAT_ID,
            userId: TEST_USER_ID,
            userName: "Test User",
            userEmail: "test@example.com",
            userMessageId: "user-msg-1",
            model: "mock-model",
          },
        },
      }),
    ).resolves.toBeUndefined();

    // Verify finish event was NOT emitted because persistence returned false
    expect(mockRealtimePublish).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "finish" }),
    );
  });

  it("5. generateChatResponse completes cleanly without unhandled error when loadChatContext throws ChatNotFoundError", async () => {
    mockAbortRegistry.register.mockReturnValue({
      controller: new AbortController(),
      release: vi.fn(),
    });

    mockLoadChatContext.mockRejectedValueOnce(new ChatNotFoundError(TEST_CHAT_ID));

    const fnHandler = generateChatResponse as unknown as (ctx: any) => Promise<any>;

    await expect(
      fnHandler({
        event: {
          data: {
            chatId: TEST_CHAT_ID,
            userId: TEST_USER_ID,
            userName: "Test User",
            userEmail: "test@example.com",
            userMessageId: "user-msg-1",
            model: "mock-model",
          },
        },
      }),
    ).resolves.toBeUndefined();

    // Error event must NOT be published for cleanly handled ChatNotFoundError
    expect(mockRealtimePublish).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "error" }),
    );
  });
});
