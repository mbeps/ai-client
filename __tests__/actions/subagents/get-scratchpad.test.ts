import { describe, expect, it, vi } from "vitest";
import { getScratchpadFilesAction } from "@/actions/subagents/get-scratchpad";
import { db } from "@/drizzle/db";
import { requireSession } from "@/lib/auth/require-session";

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("getScratchpadFilesAction", () => {
  it("throws error if message does not exist or user does not own chat", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as any);

    const mockLimit = vi.fn().mockResolvedValueOnce([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
    const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
    vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as any);

    await expect(getScratchpadFilesAction("msg-1")).rejects.toThrow(
      "Message not found or access denied.",
    );
  });

  it("returns scratchpad files when authorized", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as any);

    // First query for message validation
    const mockLimit = vi.fn().mockResolvedValueOnce([{ id: "msg-1", chatId: "chat-1" }]);
    const mockWhereMsg = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhereMsg });
    const mockFromMsg = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });

    // Second query for scratchpad files
    const mockFiles = [
      {
        id: "file-1",
        filePath: "findings.md",
        content: "Draft content",
        writtenByRole: "researcher",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const mockOrderBy = vi.fn().mockResolvedValueOnce(mockFiles);
    const mockWhereFiles = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFromFiles = vi.fn().mockReturnValue({ where: mockWhereFiles });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: mockFromMsg } as any)
      .mockReturnValueOnce({ from: mockFromFiles } as any);

    const result = await getScratchpadFilesAction("msg-1");
    expect(result).toEqual(mockFiles);
  });

  it("returns scratchpad files in 2-arg mode when chat is owned", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as any);

    const mockLimit = vi.fn().mockResolvedValueOnce([{ id: "chat-1" }]);
    const mockWhereChat = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFromChat = vi.fn().mockReturnValue({ where: mockWhereChat });

    const mockFiles = [
      {
        id: "file-2",
        filePath: "plan.json",
        content: "{}",
        writtenByRole: "planner",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const mockOrderBy = vi.fn().mockResolvedValueOnce(mockFiles);
    const mockWhereFiles = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFromFiles = vi.fn().mockReturnValue({ where: mockWhereFiles });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: mockFromChat } as any)
      .mockReturnValueOnce({ from: mockFromFiles } as any);

    const result = await getScratchpadFilesAction("chat-1", "msg-1");
    expect(result).toEqual(mockFiles);
  });

  it("throws error in 2-arg mode when user does not own chat", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as any);

    const mockLimit = vi.fn().mockResolvedValueOnce([]);
    const mockWhereChat = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFromChat = vi.fn().mockReturnValue({ where: mockWhereChat });

    vi.mocked(db.select).mockReturnValueOnce({ from: mockFromChat } as any);

    await expect(getScratchpadFilesAction("chat-1", "msg-1")).rejects.toThrow(
      "Chat not found or access denied.",
    );
  });

  it("returns empty array safely when messageId is streaming", async () => {
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as any);

    const result = await getScratchpadFilesAction("chat-1", "streaming");
    expect(result).toEqual([]);
  });
});

