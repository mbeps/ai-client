import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDownloadObject = vi.hoisted(() => vi.fn());
const mockExtractTextFromBuffer = vi.hoisted(() => vi.fn());
const mockChunkText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage/download-object", () => ({
  downloadObject: mockDownloadObject,
}));

vi.mock("@/lib/rag/extract-text-server", () => ({
  extractTextFromBuffer: mockExtractTextFromBuffer,
}));

vi.mock("@/lib/rag/chunk-text", () => ({
  chunkText: mockChunkText,
}));

import { readS3DocumentChunksByRange } from "@/lib/rag/read-s3-document-chunks";

describe("readS3DocumentChunksByRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams = {
    documentId: "doc-1",
    documentName: "Guide.md",
    mimeType: "text/markdown",
    s3Key: "uploads/guide.md",
    kbId: "kb-1",
  };

  it("downloads from S3, extracts text, chunks, and returns all chunks when range omitted", async () => {
    const buffer = Buffer.from("chunk0\nchunk1\nchunk2");
    mockDownloadObject.mockResolvedValueOnce(buffer);
    mockExtractTextFromBuffer.mockResolvedValueOnce("chunk0\nchunk1\nchunk2");
    mockChunkText.mockReturnValueOnce(["chunk0", "chunk1", "chunk2"]);

    const result = await readS3DocumentChunksByRange(baseParams);

    expect(mockDownloadObject).toHaveBeenCalledWith("uploads/guide.md");
    expect(mockExtractTextFromBuffer).toHaveBeenCalledWith(
      buffer,
      "text/markdown",
    );
    expect(mockChunkText).toHaveBeenCalledWith("chunk0\nchunk1\nchunk2");
    expect(result).toEqual([
      {
        id: "doc-1:0",
        content: "chunk0",
        documentId: "doc-1",
        documentName: "Guide.md",
        s3Key: "uploads/guide.md",
        chunkIndex: 0,
        kbId: "kb-1",
      },
      {
        id: "doc-1:1",
        content: "chunk1",
        documentId: "doc-1",
        documentName: "Guide.md",
        s3Key: "uploads/guide.md",
        chunkIndex: 1,
        kbId: "kb-1",
      },
      {
        id: "doc-1:2",
        content: "chunk2",
        documentId: "doc-1",
        documentName: "Guide.md",
        s3Key: "uploads/guide.md",
        chunkIndex: 2,
        kbId: "kb-1",
      },
    ]);
  });

  it("slices inclusive [startIndex, endIndex] and clamps out-of-bounds indices", async () => {
    mockDownloadObject.mockResolvedValueOnce(Buffer.from("text"));
    mockExtractTextFromBuffer.mockResolvedValueOnce("text");
    mockChunkText.mockReturnValueOnce(["c0", "c1", "c2", "c3"]);

    const result = await readS3DocumentChunksByRange({
      ...baseParams,
      startIndex: -2,
      endIndex: 10,
    });

    expect(result.map((r) => r.chunkIndex)).toEqual([0, 1, 2, 3]);

    const cache = new Map<string, string[]>([["doc-1", ["c0", "c1", "c2", "c3"]]]);
    const sliced = await readS3DocumentChunksByRange({
      ...baseParams,
      startIndex: 1,
      endIndex: 2,
      cache,
    });

    expect(sliced.map((r) => r.content)).toEqual(["c1", "c2"]);
  });

  it("returns empty array when chunks are empty or startIndex exceeds endIndex", async () => {
    mockDownloadObject.mockResolvedValueOnce(Buffer.from(""));
    mockExtractTextFromBuffer.mockResolvedValueOnce("");
    mockChunkText.mockReturnValueOnce([]);

    const emptyResult = await readS3DocumentChunksByRange(baseParams);
    expect(emptyResult).toEqual([]);

    const cache = new Map<string, string[]>([["doc-1", ["c0", "c1"]]]);
    const invertedRange = await readS3DocumentChunksByRange({
      ...baseParams,
      startIndex: 3,
      endIndex: 1,
      cache,
    });
    expect(invertedRange).toEqual([]);
  });

  it("reuses per-turn cache for repeated reads of the same documentId", async () => {
    const cache = new Map<string, string[]>();
    mockDownloadObject.mockResolvedValueOnce(Buffer.from("c0 c1 c2"));
    mockExtractTextFromBuffer.mockResolvedValueOnce("c0 c1 c2");
    mockChunkText.mockReturnValueOnce(["c0", "c1", "c2"]);

    const first = await readS3DocumentChunksByRange({
      ...baseParams,
      startIndex: 0,
      endIndex: 0,
      cache,
    });
    const second = await readS3DocumentChunksByRange({
      ...baseParams,
      startIndex: 1,
      endIndex: 2,
      cache,
    });

    expect(mockDownloadObject).toHaveBeenCalledTimes(1);
    expect(mockExtractTextFromBuffer).toHaveBeenCalledTimes(1);
    expect(mockChunkText).toHaveBeenCalledTimes(1);
    expect(first.map((r) => r.content)).toEqual(["c0"]);
    expect(second.map((r) => r.content)).toEqual(["c1", "c2"]);
  });

  it("propagates errors when S3 download fails (e.g., empty S3 body)", async () => {
    mockDownloadObject.mockRejectedValueOnce(
      new Error('Empty body for key "uploads/guide.md"'),
    );

    await expect(readS3DocumentChunksByRange(baseParams)).rejects.toThrow(
      'Empty body for key "uploads/guide.md"',
    );
  });
});
