import { beforeEach, describe, expect, it, vi } from "vitest";

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
    MAX_DOCUMENT_CHARS: 500000,
  },
}));

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

import { chunkText } from "@/lib/rag/chunk-text";
import { embedDocuments } from "@/lib/rag/embed-documents";
import { extractTextFromBuffer } from "@/lib/rag/extract-text-server";
import { ingestDocumentPipeline } from "@/lib/rag/ingest-pipeline";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";

function makeDoc(): KbDocumentRow {
  return {
    id: "doc-concurrency-1",
    kbId: "kb-concurrency-1",
    userId: "user-1",
    name: "concurrent-doc.pdf",
    mimeType: "application/pdf",
    size: 2048,
    s3Key: "kb/kb-concurrency-1/doc-concurrency-1/concurrent-doc.pdf",
    status: "processing",
    statusMessage: null,
    chunkCount: 0,
    tokenCount: 0,
    truncated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as KbDocumentRow;
}

describe("ingestDocumentPipeline concurrency resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.where.mockResolvedValue([]);
  });

  it("gracefully catches PostgreSQL error 23503 and returns zero counts without throwing", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("concurrent document text");
    vi.mocked(chunkText).mockReturnValue(["chunk-1"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1, 0.2]]);

    const fkError = Object.assign(
      new Error(
        'insert or update on table "kb_chunk" violates foreign key constraint "kb_chunk_document_id_kb_document_id_fk"',
      ),
      { code: "23503" },
    );

    (chainable as any).transaction = vi.fn(async () => {
      throw fkError;
    });

    const result = await ingestDocumentPipeline(
      makeDoc(),
      Buffer.from("sample-data"),
      "user-1",
    );

    expect(result).toEqual({ chunkCount: 0, tokenCount: 0 });
    // Verify document was not marked ready since it was deleted concurrently
    expect(chainable.update).not.toHaveBeenCalled();
  });
});
