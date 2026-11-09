import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  c.select = vi.fn(() => c);
  c.from = vi.fn(() => c);
  c.where = vi.fn(() => c);
  c.insert = vi.fn(() => c);
  c.values = vi.fn(() => c);
  c.returning = vi.fn(() => c);
  c.delete = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.set = vi.fn(() => c);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/config/env", () => ({
  env: {
    RATE_LIMIT_UPLOAD_RPM: 60,
  },
}));

vi.mock("@/config/knowledgebase", () => ({
  KB_CONFIG: {
    ALLOWED_MIME_TYPES: new Set([
      "application/pdf",
      "text/plain",
      "text/markdown",
      "image/png",
      "image/jpeg",
      "image/webp",
    ]),
    MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
  },
}));

const resolveEmbeddingProviderMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    modelRow: { capVision: true },
  }),
);
vi.mock("@/lib/providers/resolve-embedding-provider", () => ({
  resolveEmbeddingProvider: resolveEmbeddingProviderMock,
}));

const uploadObjectMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/upload-object", () => ({
  uploadObject: uploadObjectMock,
}));

vi.mock("@/lib/storage/ensure-bucket", () => ({
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user_test_1" },
  }),
}));

const checkRateLimitMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }),
);
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock("@/lib/attachments/resolve-mime-type", () => ({
  resolveMimeType: vi.fn(async (file: File) => {
    const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    return file.type || "text/plain";
  }),
}));

import { uploadKbDocument } from "@/actions/knowledgebases/upload-kb-document";
import { ERROR_CODE } from "@/lib/error/error-code";

const DOC_ROW = {
  id: "doc_test_1",
  kbId: "kb_test_1",
  userId: "user_test_1",
  name: "guide.txt",
  mimeType: "text/plain",
  size: 1024,
  s3Key: "kb/kb_test_1/doc_test_1/guide.txt",
  status: "pending",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeFormData(): FormData {
  const fd = new FormData();
  const file = new File([new Uint8Array(1024)], "guide.txt", {
    type: "text/plain",
  });
  fd.append("file", file);
  fd.append("kbId", DOC_ROW.kbId);
  return fd;
}

describe("uploadKbDocument — DB-first ordering with compensation (T2.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.where.mockImplementation(() =>
      Promise.resolve([{ id: DOC_ROW.kbId }]),
    );
    chainable.returning.mockImplementation(() => Promise.resolve([DOC_ROW]));
    uploadObjectMock.mockResolvedValue(undefined);
    checkRateLimitMock.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("inserts the pending row before calling uploadObject", async () => {
    const order: string[] = [];

    chainable.values.mockImplementation((() => {
      order.push("db-insert");
      return chainable;
    }) as never);
    uploadObjectMock.mockImplementation(async () => {
      order.push("s3-upload");
    });

    const result = await uploadKbDocument(makeFormData());
    expect(result.ok).toBe(true);

    expect(order.indexOf("db-insert")).toBeLessThan(order.indexOf("s3-upload"));
  });

  it("compensates by deleting the inserted row when uploadObject rejects", async () => {
    uploadObjectMock.mockRejectedValue(new Error("S3 unavailable"));

    const result = await uploadKbDocument(makeFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.INTERNAL);
    }

    expect(chainable.delete).toHaveBeenCalled();
    expect(chainable.where).toHaveBeenCalled();
  });

  it("returns the document row and marks KB stale on happy path", async () => {
    const result = await uploadKbDocument(makeFormData());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(DOC_ROW);
    }
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({ indexStatus: "stale" }),
    );
  });

  it("rejects a file whose sniffed magic bytes are a disallowed type (T9.8)", async () => {
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    const fd = new FormData();
    fd.append("file", new File([zipBytes], "doc.txt", { type: "text/plain" }));
    fd.append("kbId", DOC_ROW.kbId);

    const result = await uploadKbDocument(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.UNSUPPORTED_FILE_TYPE);
      expect(result.error.message).toContain("Spreadsheets and Office files are not supported");
    }
  });

  it("returns RATE_LIMIT when rate limit is exceeded", async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 45 });
    const result = await uploadKbDocument(makeFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.RATE_LIMIT);
      expect(result.error.message).toBe("Too many uploads. Retry in 45s.");
    }
  });

  it("returns INVALID_INPUT when no file is provided", async () => {
    const fd = new FormData();
    fd.append("kbId", DOC_ROW.kbId);
    const result = await uploadKbDocument(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(result.error.message).toBe("No file provided");
    }
  });

  it("returns INVALID_INPUT when no kbId is provided", async () => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(5)], "doc.txt", { type: "text/plain" }));
    const result = await uploadKbDocument(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(result.error.message).toBe("No kbId provided");
    }
  });

  it("returns NOT_FOUND when knowledgebase does not exist or user does not own it", async () => {
    chainable.where.mockImplementationOnce(() => Promise.resolve([]));
    const result = await uploadKbDocument(makeFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      expect(result.error.message).toBe("Not Found");
    }
  });

  it("returns FILE_TOO_LARGE when file size exceeds 50 MB limit", async () => {
    const bigFile = new File([new Uint8Array(5)], "big.txt", { type: "text/plain" });
    Object.defineProperty(bigFile, "size", { value: 50 * 1024 * 1024 + 1 });
    const fd = new FormData();
    fd.append("file", bigFile);
    fd.append("kbId", DOC_ROW.kbId);

    const result = await uploadKbDocument(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.FILE_TOO_LARGE);
      expect(result.error.message).toBe("File exceeds the 50 MB size limit.");
    }
  });

  it("allows image upload when embedding model has vision capability", async () => {
    resolveEmbeddingProviderMock.mockResolvedValueOnce({
      modelRow: { capVision: true },
    });

    const fd = new FormData();
    const imageFile = new File([new Uint8Array(100)], "architecture.png", {
      type: "image/png",
    });
    fd.append("file", imageFile);
    fd.append("kbId", DOC_ROW.kbId);

    const result = await uploadKbDocument(fd);
    expect(result.ok).toBe(true);
  });

  it("rejects image upload when embedding model does not have vision capability", async () => {
    resolveEmbeddingProviderMock.mockResolvedValueOnce({
      modelRow: { capVision: false },
    });

    const fd = new FormData();
    const imageFile = new File([new Uint8Array(100)], "architecture.png", {
      type: "image/png",
    });
    fd.append("file", imageFile);
    fd.append("kbId", DOC_ROW.kbId);

    const result = await uploadKbDocument(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERROR_CODE.UNSUPPORTED_FILE_TYPE);
      expect(result.error.message).toContain(
        "Your configured embedding model does not support images",
      );
    }
  });
});
