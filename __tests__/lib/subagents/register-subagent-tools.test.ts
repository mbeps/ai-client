import { describe, expect, it, vi } from "vitest";
import { registerScratchpadTools } from "@/lib/subagents/register-subagent-tools";
import * as scratchpadService from "@/lib/subagents/scratchpad-service";

vi.mock("@/lib/subagents/scratchpad-service", () => ({
  upsertScratchpadFile: vi.fn(),
  readScratchpadFile: vi.fn(),
  listScratchpadFiles: vi.fn(),
}));

describe("registerScratchpadTools", () => {
  const context = {
    chatId: "chat-123",
    messageId: "msg-456",
    workerRole: "researcher",
  };

  describe("scratchpad_write", () => {
    it("successfully writes file to scratchpad", async () => {
      vi.mocked(scratchpadService.upsertScratchpadFile).mockResolvedValueOnce({
        id: "file-1",
        chatId: context.chatId,
        messageId: context.messageId,
        filePath: "findings.md",
        content: "Draft content",
        writtenByRole: context.workerRole,
        version: 1,
        sizeBytes: 13,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_write.execute(
        { filePath: "findings.md", content: "Draft content" },
        { messages: [], toolCallId: "call-1" } as any,
      );

      expect(scratchpadService.upsertScratchpadFile).toHaveBeenCalledWith({
        chatId: "chat-123",
        messageId: "msg-456",
        filePath: "findings.md",
        content: "Draft content",
        writtenByRole: "researcher",
      });
      expect(result).toEqual({
        success: true,
        filePath: "findings.md",
        version: 1,
        message: 'Successfully saved "findings.md" (v1).',
      });
    });

    it("handles error during write", async () => {
      vi.mocked(scratchpadService.upsertScratchpadFile).mockRejectedValueOnce(
        new Error("Disk error"),
      );

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_write.execute(
        { filePath: "error.md", content: "error" },
        { messages: [], toolCallId: "call-2" } as any,
      );

      expect(result).toEqual({
        success: false,
        error: "Disk error",
      });
    });

    it("handles non-Error thrown object during write", async () => {
      vi.mocked(scratchpadService.upsertScratchpadFile).mockRejectedValueOnce(
        "String error",
      );

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_write.execute(
        { filePath: "error.md", content: "error" },
        { messages: [], toolCallId: "call-3" } as any,
      );

      expect(result).toEqual({
        success: false,
        error: "Failed to write scratchpad file",
      });
    });
  });

  describe("scratchpad_read", () => {
    it("returns content when file exists", async () => {
      vi.mocked(scratchpadService.readScratchpadFile).mockResolvedValueOnce({
        id: "file-1",
        chatId: context.chatId,
        messageId: context.messageId,
        filePath: "spec.json",
        content: "{}",
        writtenByRole: "planner",
        version: 2,
        sizeBytes: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_read.execute(
        { filePath: "spec.json" },
        { messages: [], toolCallId: "call-4" } as any,
      );

      expect(scratchpadService.readScratchpadFile).toHaveBeenCalledWith(
        "msg-456",
        "spec.json",
      );
      expect(result).toEqual({
        success: true,
        filePath: "spec.json",
        content: "{}",
        totalLines: 1,
        writtenByRole: "planner",
        version: 2,
      });
    });

    it("returns paginated content when startLine and lineCount are provided", async () => {
      vi.mocked(scratchpadService.readScratchpadFile).mockResolvedValueOnce({
        id: "file-123",
        chatId: "chat-123",
        messageId: "msg-456",
        filePath: "multi.txt",
        content: "line1\nline2\nline3\nline4\nline5",
        writtenByRole: "worker",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_read.execute(
        { filePath: "multi.txt", startLine: 2, lineCount: 2 },
        { messages: [], toolCallId: "call-4b" } as any,
      );

      expect(result).toEqual({
        success: true,
        filePath: "multi.txt",
        content: "line2\nline3",
        totalLines: 5,
        writtenByRole: "worker",
        version: 1,
      });
    });

    it("truncates content exceeding 15,000 characters without pagination", async () => {
      const largeContent = "line\n".repeat(4000); // ~20,000 chars
      vi.mocked(scratchpadService.readScratchpadFile).mockResolvedValueOnce({
        id: "file-large",
        chatId: "chat-123",
        messageId: "msg-456",
        filePath: "large.md",
        content: largeContent,
        writtenByRole: "worker",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_read.execute(
        { filePath: "large.md" },
        { messages: [], toolCallId: "call-large" } as any,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.content).toContain("[... File truncated at 15,000 characters.");
        expect(result.totalLines).toBe(4001);
      }
    });

    it("returns not found when file does not exist", async () => {
      vi.mocked(scratchpadService.readScratchpadFile).mockResolvedValueOnce(null);

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_read.execute(
        { filePath: "missing.md" },
        { messages: [], toolCallId: "call-5" } as any,
      );

      expect(result).toEqual({
        success: false,
        error: 'File "missing.md" not found in scratchpad.',
      });
    });

    it("handles error during read", async () => {
      vi.mocked(scratchpadService.readScratchpadFile).mockRejectedValueOnce(
        new Error("DB read failed"),
      );

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_read.execute(
        { filePath: "corrupted.md" },
        { messages: [], toolCallId: "call-6" } as any,
      );

      expect(result).toEqual({
        success: false,
        error: "DB read failed",
      });
    });

    it("handles non-Error thrown during read", async () => {
      vi.mocked(scratchpadService.readScratchpadFile).mockRejectedValueOnce("unknown");

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_read.execute(
        { filePath: "corrupted.md" },
        { messages: [], toolCallId: "call-7" } as any,
      );

      expect(result).toEqual({
        success: false,
        error: "Failed to read scratchpad file",
      });
    });
  });

  describe("scratchpad_list", () => {
    it("returns list of files", async () => {
      vi.mocked(scratchpadService.listScratchpadFiles).mockResolvedValueOnce([
        {
          id: "file-1",
          chatId: context.chatId,
          messageId: context.messageId,
          filePath: "notes.txt",
          content: "Notes",
          writtenByRole: "worker",
          version: 1,
          sizeBytes: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_list.execute(
        {},
        { messages: [], toolCallId: "call-8" } as any,
      );

      expect(scratchpadService.listScratchpadFiles).toHaveBeenCalledWith("msg-456");
      expect(result).toEqual({
        success: true,
        files: [
          {
            filePath: "notes.txt",
            writtenByRole: "worker",
            version: 1,
            sizeBytes: 5,
          },
        ],
      });
    });

    it("handles error during list", async () => {
      vi.mocked(scratchpadService.listScratchpadFiles).mockRejectedValueOnce(
        new Error("List query failed"),
      );

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_list.execute(
        {},
        { messages: [], toolCallId: "call-9" } as any,
      );

      expect(result).toEqual({
        success: false,
        error: "List query failed",
      });
    });

    it("handles non-Error thrown during list", async () => {
      vi.mocked(scratchpadService.listScratchpadFiles).mockRejectedValueOnce("list failure");

      const tools = registerScratchpadTools(context);
      const result = await tools.scratchpad_list.execute(
        {},
        { messages: [], toolCallId: "call-10" } as any,
      );

      expect(result).toEqual({
        success: false,
        error: "Failed to list scratchpad files",
      });
    });
  });
});

