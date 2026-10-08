import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireSession,
  mockSaveMemoryForUser,
  mockUpdateMemoryForUser,
  mockDeleteMemoryForUser,
  mockSelect,
} = vi.hoisted(() => ({
  mockRequireSession: vi.fn(),
  mockSaveMemoryForUser: vi.fn(),
  mockUpdateMemoryForUser: vi.fn(),
  mockDeleteMemoryForUser: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: () => mockRequireSession(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/memory/memory-service", () => ({
  saveMemoryForUser: (...args: any[]) => mockSaveMemoryForUser(...args),
  updateMemoryForUser: (...args: any[]) => mockUpdateMemoryForUser(...args),
  deleteMemoryForUser: (...args: any[]) => mockDeleteMemoryForUser(...args),
  deleteMemoriesForUser: (...args: any[]) => mockDeleteMemoryForUser(...args),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: mockSelect,
  },
}));

import { createMemory } from "@/actions/memories/create-memory";
import { deleteMemories } from "@/actions/memories/delete-memories";
import { listMemories } from "@/actions/memories/list-memories";
import { updateMemory } from "@/actions/memories/update-memory";

describe("Memory Server Actions", () => {
  const testSession = { user: { id: "user-123" } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue(testSession);
  });

  describe("listMemories", () => {
    it("fetches memories for the authenticated user", async () => {
      const mockRows = [
        {
          id: "m-1",
          userId: "user-123",
          content: "Prefers TypeScript",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockRows),
          }),
        }),
      });

      const result = await listMemories();
      expect(result).toEqual(mockRows);
      expect(mockRequireSession).toHaveBeenCalled();
    });
  });

  describe("createMemory", () => {
    it("validates input and saves memory for session user", async () => {
      const mockResult = {
        id: "m-1",
        userId: "user-123",
        content: "Prefers concise replies",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSaveMemoryForUser.mockResolvedValue(mockResult);

      const result = await createMemory({ content: "Prefers concise replies" });
      expect(result).toEqual(mockResult);
      expect(mockSaveMemoryForUser).toHaveBeenCalledWith(
        "user-123",
        "Prefers concise replies",
      );
    });

    it("rejects invalid input", async () => {
      await expect(createMemory({ content: "" })).rejects.toThrow();
    });
  });

  describe("updateMemory", () => {
    it("validates input and updates memory for session user", async () => {
      const id = crypto.randomUUID();
      const mockResult = {
        id,
        userId: "user-123",
        content: "Updated preference",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUpdateMemoryForUser.mockResolvedValue(mockResult);

      const result = await updateMemory({ id, content: "Updated preference" });
      expect(result).toEqual(mockResult);
      expect(mockUpdateMemoryForUser).toHaveBeenCalledWith(
        "user-123",
        id,
        "Updated preference",
      );
    });
  });

  describe("deleteMemories", () => {
    it("validates array of IDs and deletes memories for session user", async () => {
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      mockDeleteMemoryForUser.mockResolvedValue(undefined);

      await deleteMemories({ ids: [id1, id2] });
      expect(mockDeleteMemoryForUser).toHaveBeenCalledWith("user-123", [
        id1,
        id2,
      ]);
    });

    it("supports single memory ID in array", async () => {
      const id = crypto.randomUUID();
      mockDeleteMemoryForUser.mockResolvedValue(undefined);

      await deleteMemories({ ids: [id] });
      expect(mockDeleteMemoryForUser).toHaveBeenCalledWith("user-123", [id]);
    });
  });
});

