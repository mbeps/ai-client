import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockGetUserSettingsByUserId,
} = vi.hoisted(() => {
  return {
    mockSelect: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockGetUserSettingsByUserId: vi.fn(),
  };
});

vi.mock("@/lib/user/get-user-settings-by-id", () => ({
  getUserSettingsByUserId: (userId: string) =>
    mockGetUserSettingsByUserId(userId),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

import { deleteMemoriesForUser } from "@/lib/memory/delete-memories-for-user";
import { retrieveRelevantMemories } from "@/lib/memory/retrieve-relevant-memories";
import { saveMemoryForUser } from "@/lib/memory/save-memory-for-user";
import { updateMemoryForUser } from "@/lib/memory/update-memory-for-user";

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
      ).rejects.toThrow("Memory is disabled for this user");
      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("proceeds with save if getUserSettingsByUserId rejects", async () => {
      mockGetUserSettingsByUserId.mockRejectedValueOnce(
        new Error("Settings unavailable"),
      );
      const mockInserted = {
        id: "mem-settings-fail",
        userId: "user-1",
        content: "Still saves",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock select checking for duplicates -> none found
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockInserted]),
        }),
      });

      const result = await saveMemoryForUser("user-1", "Still saves");
      expect(result).toEqual({
        ...mockInserted,
        deduplicated: false,
      });
      expect(mockInsert).toHaveBeenCalled();
    });

    it("inserts into postgres when no duplicate memory exists", async () => {
      const now = new Date();
      const mockInserted = {
        id: "mem-1",
        userId: "user-1",
        content: "Prefers TypeScript",
        createdAt: now,
        updatedAt: now,
      };

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockInserted]),
        }),
      });

      const result = await saveMemoryForUser("user-1", "  Prefers TypeScript  ");

      expect(result).toEqual({
        id: "mem-1",
        userId: "user-1",
        content: "Prefers TypeScript",
        createdAt: now,
        updatedAt: now,
        deduplicated: false,
      });
      expect(mockInsert).toHaveBeenCalled();
    });

    it("deduplicates case-insensitive duplicate and updates updatedAt timestamp", async () => {
      const createdAt = new Date("2026-01-01T00:00:00Z");
      const oldUpdatedAt = new Date("2026-01-01T00:00:00Z");
      const newUpdatedAt = new Date("2026-01-02T12:00:00Z");

      const existingRecord = {
        id: "mem-existing",
        userId: "user-1",
        content: "Prefers TypeScript",
        createdAt,
        updatedAt: oldUpdatedAt,
      };

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingRecord]),
          }),
        }),
      });

      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...existingRecord, updatedAt: newUpdatedAt },
            ]),
          }),
        }),
      });

      const result = await saveMemoryForUser("user-1", "prefers typescript");

      expect(result).toEqual({
        id: "mem-existing",
        userId: "user-1",
        content: "Prefers TypeScript",
        createdAt,
        updatedAt: newUpdatedAt,
        deduplicated: true,
      });
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("falls back to existing.updatedAt if update returning yields no row", async () => {
      const createdAt = new Date("2026-01-01T00:00:00Z");
      const oldUpdatedAt = new Date("2026-01-01T00:00:00Z");

      const existingRecord = {
        id: "mem-existing-2",
        userId: "user-1",
        content: "Uses PostgreSQL",
        createdAt,
        updatedAt: oldUpdatedAt,
      };

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingRecord]),
          }),
        }),
      });

      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await saveMemoryForUser("user-1", "Uses PostgreSQL");

      expect(result).toEqual({
        id: "mem-existing-2",
        userId: "user-1",
        content: "Uses PostgreSQL",
        createdAt,
        updatedAt: oldUpdatedAt,
        deduplicated: true,
      });
    });
  });

  describe("updateMemoryForUser", () => {
    it("updates postgres and returns updated memory", async () => {
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

      const result = await updateMemoryForUser(
        "user-1",
        "mem-1",
        "Updated preference",
      );

      expect(result).toEqual(mockUpdated);
      expect(mockUpdate).toHaveBeenCalled();
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
    it("deletes multiple memories from postgres", async () => {
      mockDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await deleteMemoriesForUser("user-1", ["mem-1", "mem-2"]);

      expect(mockDelete).toHaveBeenCalled();
    });

    it("returns early if ids array is empty", async () => {
      await deleteMemoriesForUser("user-1", []);

      expect(mockDelete).not.toHaveBeenCalled();
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
    });

    it("proceeds with retrieval if getUserSettingsByUserId rejects", async () => {
      mockGetUserSettingsByUserId.mockRejectedValueOnce(
        new Error("Settings failed"),
      );
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ content: "Fallback memory" }]),
            }),
          }),
        }),
      });

      const memories = await retrieveRelevantMemories("user-1", "any query");
      expect(memories).toEqual(["Fallback memory"]);
    });

    it("returns empty array when user has 0 memories in database", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const memories = await retrieveRelevantMemories("user-1", "any query");
      expect(memories).toEqual([]);
    });

    it("returns memories ordered by updatedAt with limit from PostgreSQL", async () => {
      const rows = [{ content: "Memory 1" }, { content: "Memory 2" }];

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      });

      const memories = await retrieveRelevantMemories("user-1", "any query", 10);

      expect(memories).toEqual(["Memory 1", "Memory 2"]);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("uses default limit of 20 when limit parameter is omitted", async () => {
      const mockLimitFn = vi.fn().mockResolvedValue([{ content: "Default limit memory" }]);

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: mockLimitFn,
            }),
          }),
        }),
      });

      const memories = await retrieveRelevantMemories("user-1");

      expect(memories).toEqual(["Default limit memory"]);
      expect(mockLimitFn).toHaveBeenCalledWith(20);
    });
  });
});
