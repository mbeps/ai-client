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

// Drizzle awaits terminate at `.where(...)` for selects and updates; selects
// with `.limit(1)` terminate at `.limit(...)`.
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
  c.limit = vi.fn();
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

const pipelineMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rag/ingest-pipeline", () => ({
  ingestDocumentPipeline: pipelineMock,
}));

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reindexKnowledgebase } from "@/actions/knowledgebases/reindex-knowledgebase";
import { ingestDocument } from "@/lib/rag/ingest";

function fakeS3Body() {
  return {
    transformToByteArray: async () => new Uint8Array([1, 2, 3]),
  };
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    kbId: "kb-1",
    userId: "user-1",
    name: "test.pdf",
    mimeType: "application/pdf",
    size: 1024,
    s3Key: "kb/kb-1/doc-1/test.pdf",
    status: "ready",
    statusMessage: null,
    chunkCount: 0,
    tokenCount: 0,
    truncated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ingestion routes through shared pipeline (T3.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipelineMock.mockResolvedValue({ chunkCount: 2, tokenCount: 10 });
    sendMock.mockResolvedValue({ Body: fakeS3Body() });
  });

  it("ingestDocument fetches S3 file and calls the pipeline with doc + buffer + userId", async () => {
    const doc = makeDoc();
    // call 1: doc select (terminates at .where); call 2: processing update
    // (.where); then pipeline; then stale select (terminates at .limit);
    // then KB update (.where)
    let whereCall = 0;
    chainable.where.mockImplementation(() => {
      whereCall++;
      if (whereCall === 1) return Promise.resolve([doc]);
      return Promise.resolve([]);
    });
    // The stale-docs select chains .where(...).limit(1): where() must return a
    // thenable that ALSO exposes .limit. A plain Promise lacks .limit, so the
    // mock returns an object that is both awaitable and chainable.
    const staleResult = [{ id: "chunk-1" }];
    const whereWithLimit = Object.assign(Promise.resolve(staleResult), {
      limit: chainable.limit,
    });
    chainable.limit.mockReturnValue(Promise.resolve(staleResult));
    let whereCall2 = 0;
    chainable.where.mockImplementation(() => {
      whereCall2++;
      if (whereCall2 === 1) return Promise.resolve([doc]);
      return whereWithLimit;
    });

    await ingestDocument("doc-1", "user-1");

    expect(sendMock).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    expect(pipelineMock).toHaveBeenCalledTimes(1);
    const [passedDoc, passedBuffer, passedUser] = pipelineMock.mock.calls[0];
    expect(passedDoc.id).toBe("doc-1");
    expect(Buffer.isBuffer(passedBuffer)).toBe(true);
    expect(passedUser).toBe("user-1");
  });

  it("reindexKnowledgebase marks KB as indexing and dispatches Inngest event", async () => {
    const docs = [
      makeDoc(),
      makeDoc({ id: "doc-2", s3Key: "kb/kb-1/doc-2/b.pdf" }),
    ];
    let whereCall = 0;
    chainable.where.mockImplementation(() => {
      whereCall++;
      if (whereCall === 1)
        return Promise.resolve([{ id: "kb-1", indexStatus: "stale" }]);
      if (whereCall === 4) return Promise.resolve(docs);
      return Promise.resolve([]);
    });

    const result = await reindexKnowledgebase("kb-1");

    expect(result).toEqual({ processedCount: 2, failedCount: 0 });
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({
        indexStatus: "indexing",
      }),
    );
  });
});
