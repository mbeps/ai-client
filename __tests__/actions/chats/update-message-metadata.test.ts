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

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "innerJoin",
    "where",
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

import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateMessageMetadata } from "@/actions/chats/update-message-metadata";

const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const CHAT_ID = "11111111-1111-4111-8111-111111111111";

describe("updateMessageMetadata action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.innerJoin.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
  });

  it("successfully updates metadata and revalidates paths when owned by user", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        messageId: MESSAGE_ID,
        userId: "user-1",
        chatId: CHAT_ID,
        projectId: "proj-1",
        assistantId: "asst-1",
      },
    ]);
    chainable.where.mockResolvedValue(undefined);

    await updateMessageMetadata(MESSAGE_ID, JSON.stringify({ foo: "bar" }));

    expect(chainable.update).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("successfully updates metadata when projectId and assistantId are null", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        messageId: MESSAGE_ID,
        userId: "user-1",
        chatId: CHAT_ID,
        projectId: null,
        assistantId: null,
      },
    ]);
    chainable.where.mockResolvedValue(undefined);

    await updateMessageMetadata(MESSAGE_ID, null);

    expect(chainable.update).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("throws 'Unauthorized' if message does not exist or user does not own chat", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(
      updateMessageMetadata(MESSAGE_ID, '{"foo":"bar"}'),
    ).rejects.toThrow("Unauthorized");
  });
});
