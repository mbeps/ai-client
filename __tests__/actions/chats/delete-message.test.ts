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
    "selectDistinct",
    "from",
    "where",
    "delete",
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

const sweepMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/sweep-orphaned-attachment-keys", () => ({
  sweepOrphanedAttachmentKeys: sweepMock,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMessage } from "@/actions/chats/delete-message";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const MSG_ID_1 = "22222222-2222-4222-8222-222222222222";
const MSG_ID_2 = "33333333-3333-4333-8333-333333333333";
const NEW_LEAF_ID = "44444444-4444-4444-8444-444444444444";

describe("deleteMessage action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.selectDistinct.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    sweepMock.mockResolvedValue(undefined);
  });

  it("successfully deletes message, its subtree, attachments, and updates chat leaf", async () => {
    // 1. Chat ownership check
    chainable.where.mockResolvedValueOnce([{ id: CHAT_ID }]);
    // 2. Fetch all messages in chat
    chainable.where.mockResolvedValueOnce([
      { id: MSG_ID_1, parentId: null },
      { id: MSG_ID_2, parentId: MSG_ID_1 },
    ]);
    // 3. Fetch attachment keys
    chainable.where.mockResolvedValueOnce([
      { key: "attachments/user-1/file1.txt" },
    ]);
    // 4. Delete messages & update chat
    chainable.where.mockResolvedValue(undefined);

    await deleteMessage(CHAT_ID, MSG_ID_1, NEW_LEAF_ID);

    expect(chainable.delete).toHaveBeenCalled();
    expect(chainable.update).toHaveBeenCalled();
    expect(sweepMock).toHaveBeenCalledWith(["attachments/user-1/file1.txt"]);
  });

  it("throws 'Not Found' if chat does not exist or user does not own it", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(deleteMessage(CHAT_ID, MSG_ID_1, null)).rejects.toThrow(
      "Not Found",
    );
  });

  it("throws ZodError if IDs are invalid UUIDs", async () => {
    await expect(deleteMessage("not-uuid", MSG_ID_1, null)).rejects.toThrow();
  });
});
