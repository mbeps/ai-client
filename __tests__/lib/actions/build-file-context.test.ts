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

// ── spy on drizzle-orm to verify the userId filter is in the WHERE clause ────
vi.mock("drizzle-orm", async (importOriginal) => {
  const mod = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...mod,
    eq: vi.fn(mod.eq),
    and: vi.fn(mod.and),
    inArray: vi.fn(mod.inArray),
  };
});

vi.mock("@/lib/storage/get-presigned-url", () => ({
  getPresignedUrl: vi.fn().mockResolvedValue("https://example.com/file"),
}));

// ── chainable DB mock ─────────────────────────────────────────────────────────
const chainable = vi.hoisted(() => {
  const c = { select: vi.fn(), from: vi.fn(), where: vi.fn() };
  c.select.mockReturnValue(c);
  c.from.mockReturnValue(c);
  c.where.mockResolvedValue([]);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { buildFileContext } from "@/lib/transform/build-file-context";

beforeEach(() => {
  vi.clearAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  chainable.where.mockResolvedValue([]);
});

describe("buildFileContext", () => {
  it("returns empty when no attachment IDs provided", async () => {
    const result = await buildFileContext([], "user-A");
    expect(result.fileContext).toBe("");
    expect(result.attachmentRows).toHaveLength(0);
  });

  describe("IDOR security: userId filter", () => {
    it("applies eq(userId) filter to prevent cross-user access", async () => {
      await buildFileContext(["att-1"], "user-A");

      // eq must be called with the requesting user's ID so the DB filters by owner
      expect(eq).toHaveBeenCalledWith(expect.anything(), "user-A");
    });

    it("does not return file context when DB finds no matching rows for the user", async () => {
      chainable.where.mockResolvedValueOnce([]);

      const result = await buildFileContext(["att-other"], "user-A");

      expect(result.fileContext).toBe("");
      expect(result.attachmentRows).toHaveLength(0);
    });
  });
});
