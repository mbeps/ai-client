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

vi.mock("@/lib/rag/qdrant-client", () => ({
  qdrantClient: mockQdrantClient,
}));

import {
  clearMemoryCollectionCache,
  deleteMemoryPoints,
  ensureMemoryCollection,
  getMemoryCollectionName,
  searchKeywordMemories,
  searchSemanticMemories,
  upsertMemoryPoint,
} from "@/lib/memory/qdrant-memory-client";

describe("qdrant-memory-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMemoryCollectionCache();
  });

  describe("getMemoryCollectionName", () => {
    it("formats collection name by dimensionality", () => {
      expect(getMemoryCollectionName(1536)).toBe("user_memories_1536");
      expect(getMemoryCollectionName(768)).toBe("user_memories_768");
    });
  });

  describe("ensureMemoryCollection", () => {
    it("creates collection and payload indexes when collection does not exist", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(false);
      mockQdrantClient.createCollection.mockResolvedValue({});
      mockQdrantClient.createPayloadIndex.mockResolvedValue({});

      const name = await ensureMemoryCollection(1536);

      expect(name).toBe("user_memories_1536");
      expect(mockQdrantClient.collectionExists).toHaveBeenCalledWith(
        "user_memories_1536",
      );
      expect(mockQdrantClient.createCollection).toHaveBeenCalledWith(
        "user_memories_1536",
        {
          vectors: {
            size: 1536,
            distance: "Cosine",
          },
        },
      );
      expect(mockQdrantClient.createPayloadIndex).toHaveBeenCalledWith(
        "user_memories_1536",
        {
          field_name: "userId",
          field_schema: "keyword",
        },
      );
      expect(mockQdrantClient.createPayloadIndex).toHaveBeenCalledWith(
        "user_memories_1536",
        {
          field_name: "content",
          field_schema: "text",
        },
      );
    });

    it("handles object response { exists: false } from collectionExists", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue({ exists: false });
      mockQdrantClient.createCollection.mockResolvedValue({});
      mockQdrantClient.createPayloadIndex.mockResolvedValue({});

      const name = await ensureMemoryCollection(768);

      expect(name).toBe("user_memories_768");
      expect(mockQdrantClient.createCollection).toHaveBeenCalled();
    });

    it("skips creation when collection exists as boolean true", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);

      const name = await ensureMemoryCollection(1536);

      expect(name).toBe("user_memories_1536");
      expect(mockQdrantClient.createCollection).not.toHaveBeenCalled();
    });

    it("returns immediately when collection is already cached in verifiedMemoryCollections", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);

      const first = await ensureMemoryCollection(1536);
      const second = await ensureMemoryCollection(1536);

      expect(first).toBe("user_memories_1536");
      expect(second).toBe("user_memories_1536");
      expect(mockQdrantClient.collectionExists).toHaveBeenCalledTimes(1);
    });
  });

  describe("upsertMemoryPoint", () => {
    it("ensures collection and upserts point", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.upsert.mockResolvedValue({});

      await upsertMemoryPoint(1536, {
        id: "mem-1",
        vector: [0.1, 0.2],
        userId: "user-1",
        content: "Prefers concise answers",
      });

      expect(mockQdrantClient.upsert).toHaveBeenCalledWith(
        "user_memories_1536",
        {
          wait: true,
          points: [
            {
              id: "mem-1",
              vector: [0.1, 0.2],
              payload: {
                id: "mem-1",
                userId: "user-1",
                content: "Prefers concise answers",
              },
            },
          ],
        },
      );
    });
  });

  describe("deleteMemoryPoints", () => {
    it("returns early when memoryIds array is empty", async () => {
      await deleteMemoryPoints([]);
      expect(mockQdrantClient.getCollections).not.toHaveBeenCalled();
    });

    it("deletes points only from collections starting with user_memories_", async () => {
      mockQdrantClient.getCollections.mockResolvedValue({
        collections: [
          { name: "user_memories_1536" },
          { name: "kb_chunks_1536" },
          { name: "user_memories_768" },
        ],
      });
      mockQdrantClient.delete.mockResolvedValue({});

      await deleteMemoryPoints(["mem-1", "mem-2"]);

      expect(mockQdrantClient.delete).toHaveBeenCalledTimes(2);
      expect(mockQdrantClient.delete).toHaveBeenCalledWith(
        "user_memories_1536",
        {
          wait: true,
          points: ["mem-1", "mem-2"],
        },
      );
      expect(mockQdrantClient.delete).toHaveBeenCalledWith(
        "user_memories_768",
        {
          wait: true,
          points: ["mem-1", "mem-2"],
        },
      );
    });
  });

  describe("searchSemanticMemories", () => {
    it("queries Qdrant and formats results", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.query.mockResolvedValue({
        points: [
          {
            id: "mem-1",
            score: 0.95,
            payload: {
              content: "Likes TypeScript",
              userId: "user-1",
            },
          },
          {
            id: "mem-2",
            score: 0.85,
            payload: null,
          },
        ],
      });

      const results = await searchSemanticMemories(
        1536,
        [0.1, 0.2],
        "user-1",
        5,
      );

      expect(results).toEqual([
        {
          id: "mem-1",
          content: "Likes TypeScript",
          score: 0.95,
        },
        {
          id: "mem-2",
          content: "",
          score: 0.85,
        },
      ]);
      expect(mockQdrantClient.query).toHaveBeenCalledWith(
        "user_memories_1536",
        {
          query: [0.1, 0.2],
          filter: {
            must: [{ key: "userId", match: { value: "user-1" } }],
          },
          limit: 5,
          with_payload: true,
        },
      );
    });

    it("handles undefined points response gracefully", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.query.mockResolvedValue({});

      const results = await searchSemanticMemories(
        1536,
        [0.1, 0.2],
        "user-1",
        5,
      );

      expect(results).toEqual([]);
    });
  });

  describe("searchKeywordMemories", () => {
    it("returns empty array immediately if queryText is blank", async () => {
      const results = await searchKeywordMemories(1536, "   ", "user-1", 5);
      expect(results).toEqual([]);
      expect(mockQdrantClient.query).not.toHaveBeenCalled();
    });

    it("queries Qdrant by keyword content and user filter", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.query.mockResolvedValue({
        points: [
          {
            id: "mem-3",
            score: 0.9,
            payload: {
              content: "Works in London",
            },
          },
        ],
      });

      const results = await searchKeywordMemories(
        1536,
        "London",
        "user-1",
        5,
      );

      expect(results).toEqual([
        {
          id: "mem-3",
          content: "Works in London",
          score: 0.9,
        },
      ]);
      expect(mockQdrantClient.query).toHaveBeenCalledWith(
        "user_memories_1536",
        {
          filter: {
            must: [
              { key: "userId", match: { value: "user-1" } },
              { key: "content", match: { text: "London" } },
            ],
          },
          limit: 5,
          with_payload: true,
        },
      );
    });

    it("handles undefined points response gracefully", async () => {
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.query.mockResolvedValue({});

      const results = await searchKeywordMemories(
        1536,
        "London",
        "user-1",
        5,
      );

      expect(results).toEqual([]);
    });
  });
});

