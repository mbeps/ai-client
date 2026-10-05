import { describe, expect, it, vi } from "vitest";
import { RateLimitError } from "@/lib/errors";
import { ingestDocument } from "@/lib/rag/ingest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({ db: dbMock }));

const s3ClientMock = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@/lib/storage/s3-instance", () => ({
  S3_BUCKET: "test-bucket",
  s3Client: s3ClientMock,
}));

const ingestDocumentPipelineMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rag/ingest-pipeline", () => ({
  ingestDocumentPipeline: ingestDocumentPipelineMock,
}));

const isRateLimitErrorMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/error/is-rate-limit-error", () => ({
  isRateLimitError: isRateLimitErrorMock,
}));

const normalizeRateLimitMessageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/error/normalize-rate-limit-message", () => ({
  normalizeRateLimitMessage: normalizeRateLimitMessageMock,
}));

describe("ingestDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error if document not found", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    dbMock.select.mockReturnValue(mockSelect);

    await expect(ingestDocument("doc-1", "user-1")).rejects.toThrow(
      "Document not found: doc-1",
    );
  });

  it("ingests document successfully and updates knowledgebase status to ready", async () => {
    const doc = { id: "doc-1", kbId: "kb-1", s3Key: "path/to/doc.pdf" };
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // stale documents check returns []
    };
    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([doc]),
      })
      .mockReturnValue(mockSelect);

    const chainableUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    dbMock.update.mockReturnValue(chainableUpdate);

    s3ClientMock.send.mockResolvedValue({
      Body: {
        transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      },
    });

    ingestDocumentPipelineMock.mockResolvedValue(undefined);

    await ingestDocument("doc-1", "user-1");

    expect(ingestDocumentPipelineMock).toHaveBeenCalledOnce();
    expect(dbMock.update).toHaveBeenCalled();
  });

  it("handles rate limit error during ingestion and rethrows RateLimitError", async () => {
    const doc = { id: "doc-1", kbId: "kb-1", s3Key: "path/to/doc.pdf" };
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([doc]),
    });

    const chainableUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    dbMock.update.mockReturnValue(chainableUpdate);

    s3ClientMock.send.mockResolvedValue({
      Body: {
        transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1])),
      },
    });

    const rateLimitErr = new Error("Rate limit");
    ingestDocumentPipelineMock.mockRejectedValue(rateLimitErr);
    isRateLimitErrorMock.mockReturnValue(true);
    normalizeRateLimitMessageMock.mockReturnValue("Normalized rate limit error");

    await expect(ingestDocument("doc-1", "user-1")).rejects.toThrow(
      RateLimitError,
    );
  });

  it("handles generic error during ingestion and rethrows original error", async () => {
    const doc = { id: "doc-1", kbId: "kb-1", s3Key: "path/to/doc.pdf" };
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([doc]),
    });

    const chainableUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    dbMock.update.mockReturnValue(chainableUpdate);

    s3ClientMock.send.mockResolvedValue({
      Body: {
        transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1])),
      },
    });

    const genericErr = new Error("Pipeline corruption");
    ingestDocumentPipelineMock.mockRejectedValue(genericErr);
    isRateLimitErrorMock.mockReturnValue(false);

    await expect(ingestDocument("doc-1", "user-1")).rejects.toThrow(
      "Pipeline corruption",
    );
  });
});
