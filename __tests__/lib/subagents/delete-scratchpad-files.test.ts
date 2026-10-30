import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteScratchpadFiles } from "@/lib/subagents/delete-scratchpad-files";

const mockDb = vi.hoisted(() => ({
  delete: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({
  db: mockDb,
}));

describe("deleteScratchpadFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes scratchpad rows matching messageId", async () => {
    const deleteChain = {
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDb.delete.mockReturnValue(deleteChain);

    await deleteScratchpadFiles("msg-to-delete");

    expect(mockDb.delete).toHaveBeenCalled();
    expect(deleteChain.where).toHaveBeenCalled();
  });

  it("handles db errors gracefully without throwing", async () => {
    const deleteChain = {
      where: vi.fn().mockRejectedValue(new Error("DB delete connection timeout")),
    };
    mockDb.delete.mockReturnValue(deleteChain);

    await expect(deleteScratchpadFiles("msg-error")).resolves.toBeUndefined();
  });

  it("handles non-Error thrown objects gracefully", async () => {
    const deleteChain = {
      where: vi.fn().mockRejectedValue("string delete rejection"),
    };
    mockDb.delete.mockReturnValue(deleteChain);

    await expect(deleteScratchpadFiles("msg-non-error")).resolves.toBeUndefined();
  });
});

