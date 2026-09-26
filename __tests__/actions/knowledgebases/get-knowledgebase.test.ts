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
  for (const m of ["select", "from", "where", "limit"]) {
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
import { getKnowledgebase } from "@/actions/knowledgebases/get-knowledgebase";

const KB_ID = "11111111-1111-4111-8111-111111111111";

describe("getKnowledgebase action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.limit.mockReturnValue(chainable);
  });

  it("successfully retrieves knowledgebase if owned by user", async () => {
    const kbRow = {
      id: KB_ID,
      userId: "user-1",
      name: "Test KB",
      description: "Description",
      indexStatus: "ready",
      lastIndexedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    chainable.limit.mockResolvedValueOnce([kbRow]);

    const result = await getKnowledgebase(KB_ID);
    expect(result).toEqual(kbRow);
  });

  it("returns undefined if knowledgebase not found or not owned by user", async () => {
    chainable.limit.mockResolvedValueOnce([]);

    const result = await getKnowledgebase(KB_ID);
    expect(result).toBeUndefined();
  });
});
