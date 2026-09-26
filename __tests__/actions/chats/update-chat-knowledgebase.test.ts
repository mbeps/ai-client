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
  for (const m of ["select", "from", "where", "update", "set", "returning"]) {
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
import { updateChatKnowledgebase } from "@/actions/chats/update-chat-knowledgebase";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const KB_ID = "22222222-2222-4222-8222-222222222222";

describe("updateChatKnowledgebase action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
  });

  it("successfully updates knowledgebase when valid kb is owned by user", async () => {
    // kb lookup returns row
    chainable.where.mockResolvedValueOnce([{ id: KB_ID }]);
    // chat update returning returns updated row
    chainable.returning.mockResolvedValueOnce([{ id: CHAT_ID }]);

    await expect(
      updateChatKnowledgebase({ chatId: CHAT_ID, knowledgebaseId: KB_ID }),
    ).resolves.toBeUndefined();

    expect(chainable.select).toHaveBeenCalled();
    expect(chainable.update).toHaveBeenCalled();
  });

  it("successfully sets knowledgebase to null without querying knowledgebase table", async () => {
    // chat update returning returns updated row
    chainable.returning.mockResolvedValueOnce([{ id: CHAT_ID }]);

    await expect(
      updateChatKnowledgebase({ chatId: CHAT_ID, knowledgebaseId: null }),
    ).resolves.toBeUndefined();

    expect(chainable.select).not.toHaveBeenCalled();
    expect(chainable.update).toHaveBeenCalled();
  });

  it("throws 'Not Found' when knowledgebase does not exist or not owned by user", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(
      updateChatKnowledgebase({ chatId: CHAT_ID, knowledgebaseId: KB_ID }),
    ).rejects.toThrow("Not Found");
  });

  it("throws 'Not Found' when chat update does not return any row", async () => {
    chainable.where.mockResolvedValueOnce([{ id: KB_ID }]);
    chainable.returning.mockResolvedValueOnce([]);

    await expect(
      updateChatKnowledgebase({ chatId: CHAT_ID, knowledgebaseId: KB_ID }),
    ).rejects.toThrow("Not Found");
  });

  it("throws validation error for invalid input", async () => {
    await expect(
      // @ts-expect-error test invalid payload
      updateChatKnowledgebase({ chatId: "invalid-id" }),
    ).rejects.toThrow();
  });
});

