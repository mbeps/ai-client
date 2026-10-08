import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listScratchpadFiles,
  normaliseScratchpadPath,
  readScratchpadFile,
  upsertScratchpadFile,
} from "@/lib/subagents/scratchpad-service";

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
    it("inserts new file when none exists", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const insertChain = {
        values: vi.fn().mockReturnThis(),
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
    });

    it("updates existing file and increments version", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "sp-1", version: 1 }]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: "sp-1" }]),
      };
      mockDb.update.mockReturnValue(updateChain);

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
      expect(mockDb.update).toHaveBeenCalled();
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
    it("lists files with calculated sizeBytes", async () => {
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
        where: vi.fn().mockResolvedValue([sample]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const res = await listScratchpadFiles("msg-1");
      expect(res).toHaveLength(1);
      expect(res[0]?.sizeBytes).toBe(6);
      expect(res[0]?.filePath).toBe("notes/plan.md");
    });
  });
});
