import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLog,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockResolveEmbeddingProvider,
  mockEmbedQuery,
  mockUpsertMemoryPoint,
  mockDeleteMemoryPoints,
  mockSearchSemanticMemories,
  mockSearchKeywordMemories,
  mockGetUserSettingsByUserId,
} = vi.hoisted(() => {
  return {
    mockLog: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      audit: vi.fn(),
    },
    mockSelect: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockResolveEmbeddingProvider: vi.fn(),
    mockEmbedQuery: vi.fn(),
    mockUpsertMemoryPoint: vi.fn(),
    mockDeleteMemoryPoints: vi.fn(),
    mockSearchSemanticMemories: vi.fn(),
    mockSearchKeywordMemories: vi.fn(),
    mockGetUserSettingsByUserId: vi.fn(),
  };
});

vi.mock("@/lib/user/get-user-settings-by-id", () => ({
  getUserSettingsByUserId: (userId: string) =>
    mockGetUserSettingsByUserId(userId),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => mockLog),
  logger: mockLog,
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

vi.mock("@/lib/providers/resolve-embedding-provider", () => ({
  resolveEmbeddingProvider: (...args: any[]) =>
    mockResolveEmbeddingProvider(...args),
}));

vi.mock("@/lib/rag/embed-query", () => ({
  embedQuery: (...args: any[]) => mockEmbedQuery(...args),
}));

vi.mock("@/lib/memory/qdrant-memory-client", () => ({
  upsertMemoryPoint: (...args: any[]) => mockUpsertMemoryPoint(...args),
  deleteMemoryPoints: (...args: any[]) => mockDeleteMemoryPoints(...args),
  searchSemanticMemories: (...args: any[]) =>
    mockSearchSemanticMemories(...args),
  searchKeywordMemories: (...args: any[]) =>
    mockSearchKeywordMemories(...args),
}));

import {
  deleteMemoriesForUser,
  retrieveRelevantMemories,
  saveMemoryForUser,
  updateMemoryForUser,
} from "@/lib/memory/memory-service";

describe("memory-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserSettingsByUserId.mockResolvedValue(null);
  });

  describe("saveMemoryForUser", () => {
    it("throws an error when memoryEnabled is false in user settings", async () => {
      mockGetUserSettingsByUserId.mockResolvedValue({
        id: "settings-1",
        userId: "user-1",
        memoryEnabled: false,
      });

      await expect(
        saveMemoryForUser("user-1", "Prefers TypeScript"),
      ).rejects.toThrow("Memory is disabled");
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("inserts into postgres and indexes point into Qdrant when embedding available", async () => {
      const mockInserted = {
        id: "mem-1",
        userId: "user-1",
        content: "Prefers TypeScript",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockInserted]),
        }),
      });

      mockEmbedQuery.mockResolvedValue([0.1, 0.2, 0.3]);

      const result = await saveMemoryForUser("user-1", "Prefers TypeScript");

      expect(result).toEqual(mockInserted);
      expect(mockEmbedQuery).toHaveBeenCalledWith("Prefers TypeScript", "user-1");
      expect(mockUpsertMemoryPoint).toHaveBeenCalledWith(3, {
        id: "mem-1",
        vector: [0.1, 0.2, 0.3],
        userId: "user-1",
        content: "Prefers TypeScript",
      });
    });

    it("persists in postgres even if embedding fails or is unconfigured", async () => {
      const mockInserted = {
        id: "mem-2",
        userId: "user-1",
        content: "Uses Bun runtime",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockInserted]),
        }),
      });

      mockEmbedQuery.mockRejectedValue(new Error("No provider configured"));

      const result = await saveMemoryForUser("user-1", "Uses Bun runtime");

      expect(result).toEqual(mockInserted);
      expect(mockUpsertMemoryPoint).not.toHaveBeenCalled();
      expect(mockLog.warn).toHaveBeenCalled();
    });
  });

  describe("updateMemoryForUser", () => {
    it("updates postgres and re-indexes into Qdrant", async () => {
      const mockUpdated = {
        id: "mem-1",
        userId: "user-1",
        content: "Updated preference",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdated]),
          }),
        }),
      });

      mockEmbedQuery.mockResolvedValue([0.5, 0.6]);

      const result = await updateMemoryForUser(
        "user-1",
        "mem-1",
        "Updated preference",
      );

      expect(result).toEqual(mockUpdated);
      expect(mockUpsertMemoryPoint).toHaveBeenCalledWith(2, {
        id: "mem-1",
        vector: [0.5, 0.6],
        userId: "user-1",
        content: "Updated preference",
      });
    });

    it("throws error when memory to update is not found", async () => {
      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        updateMemoryForUser("user-1", "mem-missing", "Content"),
      ).rejects.toThrow("Memory not found");
    });
  });

  describe("deleteMemoriesForUser", () => {
    it("deletes multiple memories from postgres and deletes points in Qdrant", async () => {
      mockDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await deleteMemoriesForUser("user-1", ["mem-1", "mem-2"]);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteMemoryPoints).toHaveBeenCalledWith(["mem-1", "mem-2"]);
    });

    it("returns early if ids array is empty", async () => {
      await deleteMemoriesForUser("user-1", []);

      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockDeleteMemoryPoints).not.toHaveBeenCalled();
    });
  });

  describe("retrieveRelevantMemories", () => {
    it("returns empty array immediately without querying when memoryEnabled is false", async () => {
      mockGetUserSettingsByUserId.mockResolvedValue({
        id: "settings-1",
        userId: "user-1",
        memoryEnabled: false,
      });

      const memories = await retrieveRelevantMemories("user-1", "TypeScript");
      expect(memories).toEqual([]);
      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockSearchSemanticMemories).not.toHaveBeenCalled();
    });

    it("returns all memories from Postgres when total count is <= 20", async () => {
      const rows = [{ content: "Memory 1" }, { content: "Memory 2" }];

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(rows),
          }),
        }),
      });

      const memories = await retrieveRelevantMemories("user-1", "any query");

      expect(memories).toEqual(["Memory 1", "Memory 2"]);
      expect(mockEmbedQuery).not.toHaveBeenCalled();
    });

    it("uses Qdrant hybrid search when count > 20 and query exists", async () => {
      const manyRows = Array.from({ length: 25 }, (_, i) => ({
        content: `Memory ${i}`,
      }));

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(manyRows),
          }),
        }),
      });

      mockEmbedQuery.mockResolvedValue([0.1, 0.2]);
      mockSearchSemanticMemories.mockResolvedValue([
        { id: "1", content: "TypeScript rule", score: 0.9 },
      ]);
      mockSearchKeywordMemories.mockResolvedValue([
        { id: "1", content: "TypeScript rule", score: 0.8 },
      ]);

      const memories = await retrieveRelevantMemories(
        "user-1",
        "TypeScript preference",
      );

      expect(memories).toContain("TypeScript rule");
      expect(mockSearchSemanticMemories).toHaveBeenCalled();
      expect(mockSearchKeywordMemories).toHaveBeenCalled();
    });

    it("falls back to recent Postgres memories if hybrid search fails", async () => {
      const manyRows = Array.from({ length: 25 }, (_, i) => ({
        content: `Memory ${i}`,
      }));

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(manyRows),
          }),
        }),
      });

      mockEmbedQuery.mockRejectedValue(new Error("API Down"));

      const memories = await retrieveRelevantMemories("user-1", "Query");

      expect(memories.length).toBeLessThanOrEqual(10);
      expect(memories[0]).toBe("Memory 0");
    });
  });
});

