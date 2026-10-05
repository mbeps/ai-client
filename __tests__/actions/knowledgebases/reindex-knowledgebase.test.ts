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
  for (const m of ["select", "from", "where", "update", "set"]) {
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

const sendMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: sendMock },
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { reindexKnowledgebase } from "@/actions/knowledgebases/reindex-knowledgebase";

const KB_ID = "44444444-4444-4444-8444-444444444444";

describe("reindexKnowledgebase action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    sendMock.mockResolvedValue({ ids: ["event-1"] });
  });

  it("throws 'Not Found' when knowledgebase is not found or not owned by user", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(reindexKnowledgebase(KB_ID)).rejects.toThrow("Not Found");
  });

  it("successfully updates status, dispatches inngest event, and returns summary", async () => {
    // 1. KB lookup
    chainable.where.mockResolvedValueOnce([{ id: KB_ID, userId: "user-1" }]);
    // 2. KB update (not returning rows)
    chainable.where.mockReturnValueOnce(chainable);
    // 3. Document statusMessage update
    chainable.where.mockReturnValueOnce(chainable);
    // 4. Document select
    chainable.where.mockResolvedValueOnce([{ id: "doc-1" }, { id: "doc-2" }]);

    const result = await reindexKnowledgebase(KB_ID);

    expect(result).toEqual({ processedCount: 2, failedCount: 0 });
    expect(chainable.update).toHaveBeenCalledTimes(2);
    expect(sendMock).toHaveBeenCalledWith({
      name: "knowledgebase/reindex",
      data: { kbId: KB_ID, userId: "user-1" },
    });
  });
});

