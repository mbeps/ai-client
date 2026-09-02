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

// Spy on drizzle-orm condition builders so ownership filters can be verified.
vi.mock("drizzle-orm", async (importOriginal) => {
  const mod = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...mod,
    eq: vi.fn(mod.eq),
    inArray: vi.fn(mod.inArray),
    and: vi.fn(mod.and),
  };
});

// Drizzle awaits terminate at `.where(...)` for selects and at
// `.returning()` for deletes — seed those, not a fake `then`.
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

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage/s3-instance", () => ({
  s3Client: { send: sendMock },
  S3_BUCKET: "test-bucket",
}));

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { kbDocument } from "@/drizzle/schema";
import { deleteKnowledgebase } from "@/lib/actions/knowledgebases/delete-knowledgebase";
import { requireSession } from "@/lib/auth/require-session";

describe("deleteKnowledgebase — S3 cleanup (T2.4)", () => {
  let selectResult: unknown[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    // call 1: s3Key select (awaited); call 2: delete path → object with
    // returning() so db.delete().where().returning() resolves
    let whereCall = 0;
    chainable.where.mockImplementation(() => {
      whereCall++;
      if (whereCall === 1) return Promise.resolve(selectResult);
      return { returning: chainable.returning };
    });
    chainable.returning.mockResolvedValue([{ id: "kb-1" }]);
    vi.mocked(requireSession).mockResolvedValue({
      user: { id: "user-1", name: "Test User", email: "test@example.com" },
      session: { id: "session-1" },
    } as Awaited<ReturnType<typeof requireSession>>);
  });

  it("selects s3Keys BEFORE deleting the KB row", async () => {
    const order: string[] = [];
    chainable.select.mockImplementation(() => {
      order.push("select");
      return chainable;
    });
    chainable.returning.mockImplementation((() => {
      order.push("delete-returning");
      return Promise.resolve([{ id: "kb-1" }]);
    }) as never);

    await deleteKnowledgebase("kb-1");

    expect(order.indexOf("select")).toBeLessThan(
      order.indexOf("delete-returning"),
    );
  });

  it("sends DeleteObjectCommand per document key", async () => {
    // s3Keys come from the awaited select (where call 1), not returning()
    selectResult = [
      { s3Key: "kb/kb-1/doc-1/file.pdf" },
      { s3Key: "kb/kb-1/doc-2/notes.txt" },
    ];
    sendMock.mockResolvedValue({});

    const result = await deleteKnowledgebase(["kb-1"]);

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock).toHaveBeenNthCalledWith(
      1,
      expect.any(DeleteObjectCommand),
    );
    const cmd1 = sendMock.mock.calls[0][0] as DeleteObjectCommand;
    expect(cmd1.input.Bucket).toBe("test-bucket");
    expect(cmd1.input.Key).toBe("kb/kb-1/doc-1/file.pdf");
    expect(result).toEqual({ deletedCount: 1 });
  });

  it("scopes the DB delete to the owner via where", async () => {
    chainable.returning.mockResolvedValue([{ id: "kb-1" }]);
    await deleteKnowledgebase("kb-1");
    expect(chainable.where).toHaveBeenCalled();
    // Ownership filter: userId must be scoped to the requesting user
    expect(eq).toHaveBeenCalledWith(kbDocument.userId, "user-1");
  });

  it("does not throw when S3 deletion fails", async () => {
    selectResult = [{ s3Key: "kb/kb-1/doc-1/file.pdf" }];
    sendMock.mockRejectedValue(new Error("S3 down"));

    await expect(deleteKnowledgebase("kb-1")).resolves.toEqual({
      deletedCount: 1,
    });
  });
});
