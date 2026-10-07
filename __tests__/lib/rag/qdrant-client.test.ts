import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQdrantClient = vi.hoisted(() => ({
  collectionExists: vi.fn(),
  createCollection: vi.fn(),
  createPayloadIndex: vi.fn(),
  upsert: vi.fn(),
  query: vi.fn(),
  getCollections: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@qdrant/js-client-rest", () => {
  return {
    QdrantClient: vi.fn(function () {
      return mockQdrantClient;
    }),
  };
});

import {
  clearCollectionCache,
  deletePointsByDocumentId,
  deletePointsByKbIds,
  ensureQdrantCollection,
  getCollectionName,
  searchKeywordChunks,
  searchSemanticVectors,
  upsertChunkPoints,
} from "@/lib/rag/qdrant-client";

describe("qdrant-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCollectionCache();
  });

  describe("getCollectionName", () => {
    it("formats collection name by dimensionality", () => {
      expect(getCollectionName(1024)).toBe("kb_chunks_1024");
      expect(getCollectionName(1536)).toBe("kb_chunks_1536");
      expect(getCollectionName(2048)).toBe("kb_chunks_2048");
    });
  });

  describe("ensureQdrantCollection", () => {
    it("creates collection and payload indexes when collection does not exist", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: false });
      mockQdrantClient.createCollection.mockResolvedValue({});
      mockQdrantClient.createPayloadIndex.mockResolvedValue({});

      const name = await ensureQdrantCollection(1024);

      expect(name).toBe("kb_chunks_1024");
      expect(mockQdrantClient.collectionExists).toHaveBeenCalledWith("kb_chunks_1024");
      expect(mockQdrantClient.createCollection).toHaveBeenCalledWith("kb_chunks_1024", {
        vectors: {
          size: 1024,
          distance: "Cosine",
        },
      });
      expect(mockQdrantClient.createPayloadIndex).toHaveBeenCalledTimes(3);
      expect(mockQdrantClient.createPayloadIndex).toHaveBeenCalledWith("kb_chunks_1024", {
        field_name: "kbId",
        field_schema: "keyword",
      });
      expect(mockQdrantClient.createPayloadIndex).toHaveBeenCalledWith("kb_chunks_1024", {
        field_name: "documentId",
        field_schema: "keyword",
      });
      expect(mockQdrantClient.createPayloadIndex).toHaveBeenCalledWith("kb_chunks_1024", {
        field_name: "content",
        field_schema: "text",
      });
    });

    it("skips creation when collection already exists", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: true });

      const name = await ensureQdrantCollection(1536);

      expect(name).toBe("kb_chunks_1536");
      expect(mockQdrantClient.createCollection).not.toHaveBeenCalled();
      expect(mockQdrantClient.createPayloadIndex).not.toHaveBeenCalled();
    });

    it("handles boolean return from collectionExists", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);

      const name = await ensureQdrantCollection(2048);

      expect(name).toBe("kb_chunks_2048");
      expect(mockQdrantClient.createCollection).not.toHaveBeenCalled();
    });

    it("caches verified collections and skips subsequent collectionExists calls", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: true });

      await ensureQdrantCollection(768);
      await ensureQdrantCollection(768);

      expect(mockQdrantClient.collectionExists).toHaveBeenCalledTimes(1);
    });
  });

  describe("upsertChunkPoints", () => {
    it("early returns on empty points", async () => {
      await upsertChunkPoints(1024, []);
      expect(mockQdrantClient.upsert).not.toHaveBeenCalled();
    });

    it("ensures collection and upserts points with wait: true", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.upsert.mockResolvedValue({});

      const points = [
        {
          id: "p1",
          vector: [0.1, 0.2],
          payload: {
            content: "test chunk",
            kbId: "kb1",
            documentId: "doc1",
            chunkIndex: 0,
            tokenCount: 5,
            documentName: "doc.txt",
            kbName: "Docs",
            s3Key: "key.txt",
          },
        },
      ];

      await upsertChunkPoints(2, points);

      expect(mockQdrantClient.upsert).toHaveBeenCalledWith("kb_chunks_2", {
        wait: true,
        points,
      });
    });
  });

  describe("searchSemanticVectors", () => {
    it("returns empty array when kbIds is empty", async () => {
      const res = await searchSemanticVectors(1024, [0.1], [], 5);
      expect(res).toEqual([]);
      expect(mockQdrantClient.query).not.toHaveBeenCalled();
    });

    it("queries collection with vector and kbId filter, mapping to RawChunkRow", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.query.mockResolvedValue({
        points: [
          {
            id: "point-1",
            payload: {
              content: "Chunk content 1",
              documentId: "doc-1",
              chunkIndex: 0,
              documentName: "Manual.pdf",
              s3Key: "path/to/manual.pdf",
              kbId: "kb-1",
              kbName: "Knowledge Base",
            },
          },
        ],
      });

      const res = await searchSemanticVectors(2, [0.1, 0.2], ["kb-1"], 10);

      expect(res).toEqual([
        {
          id: "point-1",
          content: "Chunk content 1",
          documentId: "doc-1",
          chunkIndex: 0,
          documentName: "Manual.pdf",
          s3Key: "path/to/manual.pdf",
          kbId: "kb-1",
          kbName: "Knowledge Base",
        },
      ]);
      expect(mockQdrantClient.query).toHaveBeenCalledWith("kb_chunks_2", {
        query: [0.1, 0.2],
        filter: {
          must: [
            {
              key: "kbId",
              match: { any: ["kb-1"] },
            },
          ],
        },
        limit: 10,
        with_payload: true,
      });
    });

    it("handles null/missing payload gracefully", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.query.mockResolvedValue({
        points: [{ id: "point-empty", payload: null }],
      });

      const res = await searchSemanticVectors(2, [0.1, 0.2], ["kb-1"], 10);
      expect(res).toEqual([
        {
          id: "point-empty",
          content: "",
          documentId: "",
          chunkIndex: 0,
          documentName: "",
          s3Key: "",
          kbId: undefined,
          kbName: undefined,
        },
      ]);
    });
  });

  describe("searchKeywordChunks", () => {
    it("returns empty array for empty kbIds or empty query text", async () => {
      expect(await searchKeywordChunks(1024, "test", [], 5)).toEqual([]);
      expect(await searchKeywordChunks(1024, "   ", ["kb-1"], 5)).toEqual([]);
      expect(mockQdrantClient.query).not.toHaveBeenCalled();
    });

    it("queries collection with text match filter on content", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.query.mockResolvedValue({
        points: [
          {
            id: "point-2",
            payload: {
              content: "Keyword match content",
              documentId: "doc-2",
              chunkIndex: 1,
              documentName: "Guide.pdf",
              s3Key: "path/guide.pdf",
              kbId: "kb-2",
              kbName: "Guides",
            },
          },
        ],
      });

      const res = await searchKeywordChunks(1024, "query text", ["kb-2"], 5);

      expect(res).toHaveLength(1);
      expect(res[0].content).toBe("Keyword match content");
      expect(mockQdrantClient.query).toHaveBeenCalledWith("kb_chunks_1024", {
        filter: {
          must: [
            {
              key: "kbId",
              match: { any: ["kb-2"] },
            },
            {
              key: "content",
              match: { text: "query text" },
            },
          ],
        },
        limit: 5,
        with_payload: true,
      });
    });
  });

  describe("deletePointsByDocumentId", () => {
    it("deletes from all collections matching kb_chunks_", async () => {
      mockQdrantClient.getCollections.mockResolvedValue({
        collections: [
          { name: "kb_chunks_1024" },
          { name: "kb_chunks_1536" },
          { name: "other_collection" },
        ],
      });
      mockQdrantClient.delete.mockResolvedValue({});

      await deletePointsByDocumentId("doc-123");

      expect(mockQdrantClient.delete).toHaveBeenCalledTimes(2);
      expect(mockQdrantClient.delete).toHaveBeenCalledWith("kb_chunks_1024", {
        wait: true,
        filter: {
          must: [{ key: "documentId", match: { value: "doc-123" } }],
        },
      });
      expect(mockQdrantClient.delete).toHaveBeenCalledWith("kb_chunks_1536", {
        wait: true,
        filter: {
          must: [{ key: "documentId", match: { value: "doc-123" } }],
        },
      });
    });
  });

  describe("deletePointsByKbIds", () => {
    it("early returns when kbIds is empty", async () => {
      await deletePointsByKbIds([]);
      expect(mockQdrantClient.getCollections).not.toHaveBeenCalled();
    });

    it("deletes points matching kbIds across collections", async () => {
      mockQdrantClient.getCollections.mockResolvedValue({
        collections: [{ name: "kb_chunks_2048" }],
      });
      mockQdrantClient.delete.mockResolvedValue({});

      await deletePointsByKbIds(["kb-1", "kb-2"]);

      expect(mockQdrantClient.delete).toHaveBeenCalledWith("kb_chunks_2048", {
        wait: true,
        filter: {
          must: [{ key: "kbId", match: { any: ["kb-1", "kb-2"] } }],
        },
      });
    });
  });
});
