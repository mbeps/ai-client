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
    "innerJoin",
    "insert",
    "values",
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
import { uploadAttachment } from "@/lib/actions/attachments/upload-attachment";

const ATTACHMENT_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  messageId: "22222222-2222-4222-8222-222222222222",
  userId: "user-1",
  name: "notes.txt",
  mimeType: "text/plain",
  size: 5,
};

function makeFormData(): FormData {
  const fd = new FormData();
  fd.append(
    "file",
    new File([new Uint8Array(5)], "notes.txt", { type: "text/plain" }),
  );
  fd.append("messageId", "22222222-2222-4222-8222-222222222222");
  fd.append("attachmentId", "11111111-1111-4111-8111-111111111111");
  return fd;
}

describe("uploadAttachment — DB-first ordering with compensation (T2.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.innerJoin.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    // call 1: ownership select; later calls: compensation delete (not awaited)
    let whereCall = 0;
    chainable.where.mockImplementation(() => {
      whereCall++;
      return whereCall === 1
        ? Promise.resolve([{ chatUserId: "user-1" }])
        : chainable;
    });
    chainable.returning.mockResolvedValue([ATTACHMENT_ROW]);
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

    await uploadAttachment(makeFormData());

    expect(order.indexOf("db-insert")).toBeLessThan(order.indexOf("s3-upload"));
  });

  it("compensates by deleting the inserted row when uploadObject rejects", async () => {
    uploadObjectMock.mockRejectedValue(new Error("S3 unavailable"));

    await expect(uploadAttachment(makeFormData())).rejects.toThrow(
      "S3 unavailable",
    );

    expect(chainable.delete).toHaveBeenCalled();
    expect(chainable.where).toHaveBeenCalled();
  });

  it("returns the attachment row on happy path", async () => {
    const result = await uploadAttachment(makeFormData());
    expect(result).toEqual(ATTACHMENT_ROW);
  });

  it("reuses the client-supplied attachmentId as PK", async () => {
    await uploadAttachment(makeFormData());
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });
});
