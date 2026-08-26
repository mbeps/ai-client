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
    MAX_DOCUMENT_CHARS: 500000,
  },
}));

// Drizzle awaits terminate at `.where(...)` for selects and updates.
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
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

// Transaction: db.transaction(cb) must invoke cb with a tx that supports
// delete/insert chains; a tx failure propagates (rollback semantics).
chainable.transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
  };
  return cb(tx);
});

vi.mock("@/lib/rag/extract-text-server", () => ({
  MAX_DOCUMENT_CHARS_LIMIT: 100,
  extractTextFromBuffer: vi.fn(),
}));

vi.mock("@/lib/rag/chunk-text", () => ({
  chunkText: vi.fn(),
}));

vi.mock("@/lib/rag/embed-documents", () => ({
  embedDocuments: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestDocumentPipeline } from "@/lib/rag/ingest-pipeline";
import { kbChunk } from "@/drizzle/schema";
import { extractTextFromBuffer } from "@/lib/rag/extract-text-server";
import { chunkText } from "@/lib/rag/chunk-text";
import { embedDocuments } from "@/lib/rag/embed-documents";
import { RagExtractionEmptyError } from "@/constants/errors";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";

function makeDoc(overrides: Partial<KbDocumentRow> = {}): KbDocumentRow {
  return {
    id: "doc-1",
    kbId: "kb-1",
    userId: "user-1",
    name: "test.pdf",
    mimeType: "application/pdf",
    size: 1024,
    s3Key: "kb/kb-1/doc-1/test.pdf",
    status: "processing",
    statusMessage: null,
    chunkCount: 0,
    tokenCount: 0,
    truncated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as KbDocumentRow;
}

describe("ingestDocumentPipeline (T3.5/T3.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.where.mockResolvedValue([]);
  });

  it("deletes old chunks and inserts one row per chunk with expected fields", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("some text");
    vi.mocked(chunkText).mockReturnValue(["chunk-a", "chunk-b"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1], [0.2]]);

    const result = await ingestDocumentPipeline(
      makeDoc(),
      Buffer.from("x"),
      "user-1",
    );

    // delete+insert ran inside a transaction
    expect(chainable.transaction).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      chunkCount: 2,
      tokenCount: Math.round(("chunk-a" + "chunk-b").length / 4),
    });
  });

  it("runs delete before insert inside the transaction and rolls back on insert failure", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("some text");
    vi.mocked(chunkText).mockReturnValue(["chunk-a"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1]]);

    // Capture the tx passed to the callback and force insert failure
    let capturedTx: any;
    (chainable.transaction as any).mockImplementationOnce(
      async (cb: (tx: any) => Promise<unknown>) => {
        capturedTx = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockRejectedValue(new Error("insert failed")),
          }),
        };
        return cb(capturedTx);
      },
    );

    await expect(
      ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1"),
    ).rejects.toThrow("insert failed");

    // Both statements were issued against the same tx, delete first
    expect(capturedTx.delete).toHaveBeenCalledWith(kbChunk);
    expect(capturedTx.insert).toHaveBeenCalledWith(kbChunk);
    expect(capturedTx.delete.mock.invocationCallOrder[0]).toBeLessThan(
      capturedTx.insert.mock.invocationCallOrder[0],
    );
  });

  it("marks the document ready with counts on final update", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("hello world");
    vi.mocked(chunkText).mockReturnValue(["hello"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.5]]);

    await ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1");

    const setArg = chainable.set.mock.calls.at(-1)![0];
    expect(setArg).toMatchObject({
      status: "ready",
      statusMessage: null,
      chunkCount: 1,
      truncated: false,
    });
  });

  it("throws RagExtractionEmptyError when extraction is empty", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("   ");

    await expect(
      ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1"),
    ).rejects.toThrow(RagExtractionEmptyError);
  });

  it("sets truncated=true when extracted text reaches the limit", async () => {
    const longText = "a".repeat(100); // === MAX_DOCUMENT_CHARS_LIMIT (100)
    vi.mocked(extractTextFromBuffer).mockResolvedValue(longText);
    vi.mocked(chunkText).mockReturnValue([longText]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1]]);

    await ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1");

    const setArg = chainable.set.mock.calls.at(-1)![0];
    expect(setArg.truncated).toBe(true);
    expect(setArg.statusMessage).toContain("truncated");
  });

  it("sets truncated=false for short extractions", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("short");
    vi.mocked(chunkText).mockReturnValue(["short"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1]]);

    await ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1");

    const setArg = chainable.set.mock.calls.at(-1)![0];
    expect(setArg.truncated).toBe(false);
    expect(setArg.statusMessage).toBeNull();
  });
});
