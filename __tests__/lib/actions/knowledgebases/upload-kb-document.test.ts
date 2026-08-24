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

// Drizzle awaits terminate at `.where(...)` for selects and at
// `.returning()` for inserts — seed those, not a fake `then`.
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

const uploadObjectMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage/upload-object", () => ({
  uploadObject: uploadObjectMock,
}));

vi.mock("@/lib/storage/ensure-bucket", () => ({
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadKbDocument } from "@/lib/actions/knowledgebases/upload-kb-document";

const DOC_ROW = {
  id: "33333333-3333-4333-8333-333333333333",
  kbId: "44444444-4444-4444-8444-444444444444",
  userId: "user-1",
  name: "doc.txt",
  mimeType: "text/plain",
  size: 5,
  status: "pending",
};

function makeFormData(): FormData {
  const fd = new FormData();
  fd.append(
    "file",
    new File([new Uint8Array(5)], "doc.txt", { type: "text/plain" }),
  );
  fd.append("kbId", "44444444-4444-4444-8444-444444444444");
  return fd;
}

describe("uploadKbDocument — DB-first ordering with compensation (T2.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    // call 1: KB ownership select; later calls: compensation delete (not awaited)
    let whereCall = 0;
    chainable.where.mockImplementation(() => {
      whereCall++;
      return whereCall === 1
        ? Promise.resolve([{ id: DOC_ROW.kbId }])
        : chainable;
    });
    chainable.returning.mockResolvedValue([DOC_ROW]);
    uploadObjectMock.mockResolvedValue(undefined);
  });

  it("inserts the DB row BEFORE calling uploadObject", async () => {
    const order: string[] = [];
    chainable.values.mockImplementation((() => {
      order.push("db-insert");
      return chainable;
    }) as never);
    uploadObjectMock.mockImplementation(async () => {
      order.push("s3-upload");
    });

    await uploadKbDocument(makeFormData());

    expect(order.indexOf("db-insert")).toBeLessThan(order.indexOf("s3-upload"));
  });

  it("compensates by deleting the inserted row when uploadObject rejects", async () => {
    uploadObjectMock.mockRejectedValue(new Error("S3 unavailable"));

    await expect(uploadKbDocument(makeFormData())).rejects.toThrow(
      "S3 unavailable",
    );

    expect(chainable.delete).toHaveBeenCalled();
    expect(chainable.where).toHaveBeenCalled();
  });

  it("returns the document row and marks KB stale on happy path", async () => {
    const result = await uploadKbDocument(makeFormData());
    expect(result).toEqual(DOC_ROW);
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ indexStatus: "stale" }),
    );
  });

  it("rejects a file whose sniffed magic bytes are a disallowed type (T9.8)", async () => {
    // Claims text/plain but bytes are a ZIP archive → sniffs as xlsx, not allowed for KBs.
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    const fd = new FormData();
    fd.append("file", new File([zipBytes], "doc.txt", { type: "text/plain" }));
    fd.append("kbId", DOC_ROW.kbId);

    await expect(uploadKbDocument(fd)).rejects.toThrow(/not supported/i);
  });
});
