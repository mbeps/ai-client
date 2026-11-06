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

const checkRateLimitMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }),
);
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadAttachment } from "@/actions/attachments/upload-attachment";

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
    chainable.where.mockImplementation(() => Promise.resolve([{ chatUserId: "user-1" }]));
    chainable.returning.mockResolvedValue([ATTACHMENT_ROW]);
    uploadObjectMock.mockResolvedValue(undefined);
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
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

    const res = await uploadAttachment(makeFormData());
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "INTERNAL",
      }),
    });

    expect(chainable.delete).toHaveBeenCalled();
    expect(chainable.where).toHaveBeenCalled();
  });

  it("returns the attachment row on happy path", async () => {
    const result = await uploadAttachment(makeFormData());
    expect(result).toEqual({ ok: true, value: ATTACHMENT_ROW });
  });

  it("reuses the client-supplied attachmentId as PK", async () => {
    await uploadAttachment(makeFormData());
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("throws when rate limited", async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 15 });
    const res = await uploadAttachment(makeFormData());
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "RATE_LIMIT",
        message: "Too many uploads. Retry in 15s.",
      }),
    });
  });

  it("throws when file or messageId is missing", async () => {
    const fdNoFile = new FormData();
    fdNoFile.append("messageId", "22222222-2222-4222-8222-222222222222");
    const res1 = await uploadAttachment(fdNoFile);
    expect(res1).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "INVALID_INPUT",
        message: "No file provided",
      }),
    });

    const fdNoMsg = new FormData();
    fdNoMsg.append("file", new File([new Uint8Array(5)], "notes.txt", { type: "text/plain" }));
    const res2 = await uploadAttachment(fdNoMsg);
    expect(res2).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "INVALID_INPUT",
        message: "No messageId provided",
      }),
    });
  });

  it("throws Forbidden when message owner is missing or does not match current user", async () => {
    chainable.where.mockReturnValueOnce(Promise.resolve([]));
    const res1 = await uploadAttachment(makeFormData());
    expect(res1).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "FORBIDDEN",
        message: "Forbidden",
      }),
    });

    chainable.where.mockReturnValueOnce(Promise.resolve([{ chatUserId: "other-user" }]));
    const res2 = await uploadAttachment(makeFormData());
    expect(res2).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "FORBIDDEN",
        message: "Forbidden",
      }),
    });
  });

  it("throws when file type is not supported", async () => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array([0x00, 0x01, 0x02])], "data.unknown", { type: "application/x-unknown" }));
    fd.append("messageId", "22222222-2222-4222-8222-222222222222");

    const res = await uploadAttachment(fd);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "UNSUPPORTED_FILE_TYPE",
      }),
    });
  });

  it("enforces image and document size limits", async () => {
    const fdImage = new FormData();
    fdImage.append("file", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "pic.png", { type: "image/png" }));
    fdImage.append("messageId", "22222222-2222-4222-8222-222222222222");

    expect(await uploadAttachment(fdImage)).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "FILE_TOO_LARGE",
        message: "File exceeds the 2 MB size limit.",
      }),
    });

    const fdDoc = new FormData();
    fdDoc.append("file", new File([new Uint8Array(20 * 1024 * 1024 + 1)], "doc.pdf", { type: "application/pdf" }));
    fdDoc.append("messageId", "22222222-2222-4222-8222-222222222222");

    expect(await uploadAttachment(fdDoc)).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "FILE_TOO_LARGE",
        message: "File exceeds the 20 MB size limit.",
      }),
    });

    const fdSheet = new FormData();
    fdSheet.append("file", new File([new Uint8Array(50 * 1024 * 1024 + 1)], "sheet.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    fdSheet.append("messageId", "22222222-2222-4222-8222-222222222222");

    expect(await uploadAttachment(fdSheet)).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "FILE_TOO_LARGE",
        message: "File exceeds the 50 MB size limit.",
      }),
    });
  });

  it("handles empty resolved mimeType reporting 'unknown'", async () => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(5)], "unknown_file", { type: "" }));
    fd.append("messageId", "22222222-2222-4222-8222-222222222222");

    const res = await uploadAttachment(fd);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "UNSUPPORTED_FILE_TYPE",
        message: 'File type "unknown" is not supported.',
      }),
    });
  });

  it("generates UUID when clientAttachmentId is omitted and stores extractedText", async () => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(5)], "doc.txt", { type: "text/plain" }));
    fd.append("messageId", "22222222-2222-4222-8222-222222222222");
    fd.append("extractedText", "Extracted content from file");

    await uploadAttachment(fd);

    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        extractedText: "Extracted content from file",
      }),
    );
  });

  it("handles string error rejection from uploadObject during compensation", async () => {
    uploadObjectMock.mockRejectedValue("String upload error");

    const res = await uploadAttachment(makeFormData());
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "INTERNAL",
      }),
    });
    expect(chainable.delete).toHaveBeenCalled();
  });

  it("returns INVALID_INPUT when messageId is not a valid UUID", async () => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(5)], "doc.txt", { type: "text/plain" }));
    fd.append("messageId", "not-a-valid-uuid");

    const res = await uploadAttachment(fd);
    expect(res).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "INVALID_INPUT",
        message: "Invalid messageId provided",
      }),
    });
  });
});
