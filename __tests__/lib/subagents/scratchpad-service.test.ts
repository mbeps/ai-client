import { beforeEach, describe, expect, it, vi } from "vitest";
import { listScratchpadFiles } from "@/lib/subagents/list-scratchpad-files";
import { normaliseScratchpadPath } from "@/lib/subagents/normalise-scratchpad-path";
import { readScratchpadFile } from "@/lib/subagents/read-scratchpad-file";
import { upsertScratchpadFile } from "@/lib/subagents/scratchpad-service";

const mockDb = vi.hoisted(() => {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
});

vi.mock("@/drizzle/db", () => ({
  db: mockDb,
}));

describe("scratchpad-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normaliseScratchpadPath", () => {
    it("strips leading slashes and prevents directory traversal", () => {
      expect(normaliseScratchpadPath("/notes/doc.md")).toBe("notes/doc.md");
      expect(normaliseScratchpadPath("../../secret.env")).toBe("secret.env");
      expect(normaliseScratchpadPath("")).toBe("note.txt");
    });
  });

  describe("upsertScratchpadFile", () => {
    it("inserts or updates file atomically using onConflictDoUpdate", async () => {
      const insertChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          { id: "sp-1", filePath: "notes/analysis.md", version: 1 },
        ]),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const result = await upsertScratchpadFile({
        chatId: "chat-1",
        messageId: "msg-1",
        filePath: "notes/analysis.md",
        content: "Initial analysis",
        writtenByRole: "researcher",
      });

      expect(result).toEqual({
        id: "sp-1",
        filePath: "notes/analysis.md",
        version: 1,
      });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.onConflictDoUpdate).toHaveBeenCalled();
    });

    it("returns updated version on subsequent atomic upsert", async () => {
      const insertChain = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          { id: "sp-1", filePath: "notes/analysis.md", version: 2 },
        ]),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const result = await upsertScratchpadFile({
        chatId: "chat-1",
        messageId: "msg-1",
        filePath: "notes/analysis.md",
        content: "Updated analysis",
        writtenByRole: "reviewer",
      });

      expect(result).toEqual({
        id: "sp-1",
        filePath: "notes/analysis.md",
        version: 2,
      });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.onConflictDoUpdate).toHaveBeenCalled();
    });
  });

  describe("readScratchpadFile", () => {
    it("returns null when file does not exist", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const res = await readScratchpadFile("msg-1", "notes/missing.md");
      expect(res).toBeNull();
    });

    it("returns record when file exists", async () => {
      const sample = {
        id: "sp-1",
        filePath: "notes/plan.md",
        content: "# Plan",
        writtenByRole: "planner",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([sample]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const res = await readScratchpadFile("msg-1", "notes/plan.md");
      expect(res).toEqual(sample);
    });
  });

  describe("listScratchpadFiles", () => {
    it("lists files with projected sizeBytes without transferring full content column", async () => {
      const sample = {
        id: "sp-1",
        filePath: "notes/plan.md",
        writtenByRole: "planner",
        version: 1,
        sizeBytes: 6,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([sample]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const res = await listScratchpadFiles("msg-1");

      const selectFields = mockDb.select.mock.calls[0][0];
      expect(selectFields).toHaveProperty("sizeBytes");
      expect(selectFields).not.toHaveProperty("content");

      expect(res).toHaveLength(1);
      expect(res[0]?.sizeBytes).toBe(6);
      expect(res[0]?.filePath).toBe("notes/plan.md");
    });

    it("safely coerces string or null sizeBytes to number", async () => {
      const sample = {
        id: "sp-2",
        filePath: "notes/calc.md",
        writtenByRole: "researcher",
        version: 1,
        sizeBytes: "42",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const nullSample = {
        id: "sp-3",
        filePath: "notes/empty.md",
        writtenByRole: "researcher",
        version: 1,
        sizeBytes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([sample, nullSample]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const res = await listScratchpadFiles("msg-2");
      expect(res[0]?.sizeBytes).toBe(42);
      expect(res[1]?.sizeBytes).toBe(0);
    });
  });
});
