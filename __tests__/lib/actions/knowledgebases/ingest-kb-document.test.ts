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

// Drizzle awaits terminate at `.where(...)` for selects — seed that, not a fake `then`.
const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.where = vi.fn();
  c.returning = vi.fn();
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

const ingestDocumentMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rag/ingest", () => ({
  ingestDocument: ingestDocumentMock,
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitError } from "@/constants/errors";
import { ingestKbDocument } from "@/lib/actions/knowledgebases/ingest-kb-document";

describe("ingestKbDocument — RateLimitError handling (T3.8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ownership check finds the document.
    chainable.where.mockResolvedValue([
      { id: "00000000-0000-4000-8000-000000000001" },
    ]);
  });

  it("returns the rate limit message, not the generic unexpected-error message", async () => {
    ingestDocumentMock.mockRejectedValue(
      new RateLimitError("Embedding provider rate limited, retry later"),
    );

    const result = await ingestKbDocument(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(result).toEqual({
      success: false,
      error: "Embedding provider rate limited, retry later",
    });
    expect(result.error).not.toBe(
      "An unexpected error occurred during ingestion",
    );
  });
});
