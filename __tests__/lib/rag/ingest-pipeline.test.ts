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
    MAX_DOCUMENT_CHARS: 500000,
  },
}));

// Drizzle awaits terminate at `.where(...)` for selects and updates.
const chainable = vi.hoisted(() => {
  const selectChain = {} as Record<string, ReturnType<typeof vi.fn>>;
  selectChain.from = vi.fn().mockImplementation(() => selectChain);
  selectChain.where = vi.fn();

  const updateChain = {} as Record<string, ReturnType<typeof vi.fn>>;
  updateChain.set = vi.fn().mockImplementation(() => updateChain);
  updateChain.where = vi.fn().mockResolvedValue(undefined);

  return {
    select: vi.fn().mockImplementation(() => selectChain),
    update: vi.fn().mockImplementation(() => updateChain),
    where: selectChain.where,
    set: updateChain.set,
    updateWhere: updateChain.where,
  };
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

const deletePointsByDocumentIdMock = vi.hoisted(() => vi.fn());
const upsertChunkPointsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rag/qdrant-client", () => ({
  deletePointsByDocumentId: deletePointsByDocumentIdMock,
  upsertChunkPoints: upsertChunkPointsMock,
}));

const extractDocumentMetadataMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rag/extract-document-metadata", () => ({
  extractDocumentMetadata: extractDocumentMetadataMock,
}));

const generateDocumentRelationsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rag/generate-document-relations", () => ({
  generateDocumentRelations: generateDocumentRelationsMock,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { RagExtractionEmptyError } from "@/lib/error/rag-extraction-empty-error";
import { chunkText } from "@/lib/rag/chunk-text";
import { embedDocuments } from "@/lib/rag/embed-documents";
import { extractDocumentMetadata } from "@/lib/rag/extract-document-metadata";
import { extractTextFromBuffer } from "@/lib/rag/extract-text-server";
import { generateDocumentRelations } from "@/lib/rag/generate-document-relations";
import { ingestDocumentPipeline } from "@/lib/rag/ingest-pipeline";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";

function makeDoc(_overrides: Partial<KbDocumentRow> = {}): KbDocumentRow {
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
    ..._overrides,
  } as KbDocumentRow;
}

describe("ingestDocumentPipeline (Qdrant)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.where.mockResolvedValue([{ id: "doc-1" }]);
    extractDocumentMetadataMock.mockResolvedValue({
      documentType: "general",
      summary: "Default summary",
      keyEntities: ["Entity1"],
      tableOfContents: [
        { title: "Section 1", chunkStartIndex: 0, chunkEndIndex: 0 },
      ],
    });
    generateDocumentRelationsMock.mockResolvedValue(0);
  });

  it("deletes old points in Qdrant and upserts new points with expected fields", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("some text");
    vi.mocked(chunkText).mockReturnValue(["chunk-a", "chunk-b"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1], [0.2]]);

    // doc check returns doc; kb check returns kb
    chainable.where
      .mockResolvedValueOnce([{ id: "doc-1" }])
      .mockResolvedValueOnce([{ name: "My KB" }]);

    const result = await ingestDocumentPipeline(
      makeDoc(),
      Buffer.from("x"),
      "user-1",
    );

    expect(deletePointsByDocumentIdMock).toHaveBeenCalledWith("doc-1");
    expect(upsertChunkPointsMock).toHaveBeenCalledTimes(1);
    expect(upsertChunkPointsMock).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          vector: [0.1],
          payload: expect.objectContaining({
            content: "chunk-a",
            kbId: "kb-1",
            documentId: "doc-1",
            chunkIndex: 0,
            documentName: "test.pdf",
            kbName: "My KB",
            s3Key: "kb/kb-1/doc-1/test.pdf",
          }),
        }),
      ]),
    );

    expect(result).toEqual({
      chunkCount: 2,
      tokenCount: Math.round(("chunk-a" + "chunk-b").length / 4),
    });
  });

  it("propagates error when upsertChunkPoints fails", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("some text");
    vi.mocked(chunkText).mockReturnValue(["chunk-a"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1]]);

    chainable.where
      .mockResolvedValueOnce([{ id: "doc-1" }])
      .mockResolvedValueOnce([{ name: "My KB" }]);

    upsertChunkPointsMock.mockRejectedValueOnce(new Error("Qdrant upsert failed"));

    await expect(
      ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1"),
    ).rejects.toThrow("Qdrant upsert failed");
  });

  it("marks the document ready with counts on final update", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("hello world");
    vi.mocked(chunkText).mockReturnValue(["hello"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.5]]);

    chainable.where
      .mockResolvedValueOnce([{ id: "doc-1" }])
      .mockResolvedValueOnce([{ name: "My KB" }]);

    await ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1");

    const setArg = chainable.set.mock.calls.at(-1)![0];
    expect(setArg).toMatchObject({
      status: "ready",
      statusMessage: null,
      chunkCount: 1,
      truncated: false,
      documentType: "general",
      summary: "Default summary",
      keyEntities: ["Entity1"],
      tableOfContents: [
        { title: "Section 1", chunkStartIndex: 0, chunkEndIndex: 0 },
      ],
    });
    expect(extractDocumentMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentName: "test.pdf",
        chunks: ["hello"],
        userId: "user-1",
      }),
    );
    expect(generateDocumentRelationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        doc: {
          id: "doc-1",
          kbId: "kb-1",
          name: "test.pdf",
          documentType: "general",
          summary: "Default summary",
          keyEntities: ["Entity1"],
        },
        userId: "user-1",
      }),
    );
  });

  it("throws RagExtractionEmptyError when extraction is empty", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("   ");

    await expect(
      ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1"),
    ).rejects.toThrow(RagExtractionEmptyError);
  });

  it("sets truncated=true when extracted text reaches the limit", async () => {
    const longText = "a".repeat(100);
    vi.mocked(extractTextFromBuffer).mockResolvedValue(longText);
    vi.mocked(chunkText).mockReturnValue([longText]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1]]);

    chainable.where
      .mockResolvedValueOnce([{ id: "doc-1" }])
      .mockResolvedValueOnce([{ name: "My KB" }]);

    await ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1");

    const setArg = chainable.set.mock.calls.at(-1)![0];
    expect(setArg.truncated).toBe(true);
    expect(setArg.statusMessage).toContain("truncated");
  });

  it("sets truncated=false for short extractions", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("short");
    vi.mocked(chunkText).mockReturnValue(["short"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1]]);

    chainable.where
      .mockResolvedValueOnce([{ id: "doc-1" }])
      .mockResolvedValueOnce([{ name: "My KB" }]);

    await ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1");

    const setArg = chainable.set.mock.calls.at(-1)![0];
    expect(setArg.truncated).toBe(false);
    expect(setArg.statusMessage).toBeNull();
  });

  it("handles document deleted concurrently before chunk persistence gracefully", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("some text");
    vi.mocked(chunkText).mockReturnValue(["chunk-a"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1]]);

    // doc check returns empty array (doc was deleted)
    chainable.where.mockResolvedValueOnce([]);

    const result = await ingestDocumentPipeline(
      makeDoc(),
      Buffer.from("x"),
      "user-1",
    );

    expect(result).toEqual({ chunkCount: 0, tokenCount: 0 });
    expect(deletePointsByDocumentIdMock).toHaveBeenCalledWith("doc-1");
    expect(upsertChunkPointsMock).not.toHaveBeenCalled();
    expect(generateDocumentRelationsMock).not.toHaveBeenCalled();
  });

  it("uses providedKbName directly without DB lookup when provided", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("sample text");
    vi.mocked(chunkText).mockReturnValue(["sample text"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1, 0.2]]);

    chainable.where.mockResolvedValueOnce([{ id: "doc-1" }]);

    await ingestDocumentPipeline(
      makeDoc(),
      Buffer.from("x"),
      "user-1",
      "Explicit KB Name",
    );

    expect(upsertChunkPointsMock).toHaveBeenCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ kbName: "Explicit KB Name" }),
        }),
      ]),
    );
  });

  it("falls back to empty string when kb row is not found in db", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("sample text");
    vi.mocked(chunkText).mockReturnValue(["sample text"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.1, 0.2]]);

    chainable.where
      .mockResolvedValueOnce([{ id: "doc-1" }])
      .mockResolvedValueOnce([]); // kb row not found

    await ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1");

    expect(upsertChunkPointsMock).toHaveBeenCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ kbName: "" }),
        }),
      ]),
    );
  });

  it("skips upsertChunkPoints if dimensions is 0 or embeddings empty", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("sample text");
    vi.mocked(chunkText).mockReturnValue(["sample text"]);
    vi.mocked(embedDocuments).mockResolvedValue([]);

    chainable.where
      .mockResolvedValueOnce([{ id: "doc-1" }])
      .mockResolvedValueOnce([{ name: "My KB" }]);

    await ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1");

    expect(deletePointsByDocumentIdMock).toHaveBeenCalledWith("doc-1");
    expect(upsertChunkPointsMock).not.toHaveBeenCalled();
  });

  it("tracks step transitions and notifies onStepChange through all pipeline stages", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("hello world");
    vi.mocked(chunkText).mockReturnValue(["hello"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.5]]);

    chainable.where
      .mockResolvedValueOnce([{ id: "doc-1" }])
      .mockResolvedValueOnce([{ name: "My KB" }]);

    const stepsObserved: string[] = [];
    await ingestDocumentPipeline(
      makeDoc(),
      Buffer.from("x"),
      "user-1",
      undefined,
      (step) => stepsObserved.push(step),
    );

    expect(stepsObserved).toEqual([
      "extracting",
      "embedding",
      "metadata",
      "relations",
    ]);

    expect(chainable.set.mock.calls.map((c) => c[0].ingestSteps)).toEqual([
      {
        uploading: { status: "completed" },
        extracting: { status: "completed" },
        embedding: { status: "loading" },
        metadata: { status: "pending" },
        relations: { status: "pending" },
      },
      {
        uploading: { status: "completed" },
        extracting: { status: "completed" },
        embedding: { status: "completed" },
        metadata: { status: "loading" },
        relations: { status: "pending" },
      },
      {
        uploading: { status: "completed" },
        extracting: { status: "completed" },
        embedding: { status: "completed" },
        metadata: { status: "completed" },
        relations: { status: "loading" },
      },
      {
        uploading: { status: "completed" },
        extracting: { status: "completed" },
        embedding: { status: "completed" },
        metadata: { status: "completed" },
        relations: { status: "completed" },
      },
    ]);
  });

  it("marks metadata or relations step as failed when fallback/error callbacks fire while keeping doc ready", async () => {
    vi.mocked(extractTextFromBuffer).mockResolvedValue("hello world");
    vi.mocked(chunkText).mockReturnValue(["hello"]);
    vi.mocked(embedDocuments).mockResolvedValue([[0.5]]);

    chainable.where
      .mockResolvedValueOnce([{ id: "doc-1" }])
      .mockResolvedValueOnce([{ name: "My KB" }]);

    extractDocumentMetadataMock.mockImplementationOnce(async ({ onFallback }) => {
      onFallback?.("No chat model configured");
      return {
        documentType: "general",
        summary: "Fallback",
        keyEntities: [],
        tableOfContents: [],
      };
    });

    generateDocumentRelationsMock.mockImplementationOnce(async ({ onError }) => {
      onError?.("Relation LLM timeout");
      return 0;
    });

    await ingestDocumentPipeline(makeDoc(), Buffer.from("x"), "user-1");

    const finalUpdate = chainable.set.mock.calls.at(-1)![0];
    expect(finalUpdate.status).toBe("ready");
    expect(finalUpdate.ingestSteps).toEqual({
      uploading: { status: "completed" },
      extracting: { status: "completed" },
      embedding: { status: "completed" },
      metadata: { status: "failed", error: "No chat model configured" },
      relations: { status: "failed", error: "Relation LLM timeout" },
    });
  });
});
