import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSaveMemoryForUser } = vi.hoisted(() => ({
  mockSaveMemoryForUser: vi.fn(),
}));

vi.mock("@/lib/memory/memory-service", () => ({
  saveMemoryForUser: (...args: any[]) => mockSaveMemoryForUser(...args),
}));

import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { registerMemoryTool } from "@/lib/chat/register-memory-tool";

describe("registerMemoryTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty object if tool is gated out", () => {
    const tools = registerMemoryTool("user-1", ["other_tool"]);
    expect(tools).toEqual({});
  });

  it("registers save_memory tool when selectedTools is undefined or includes MANAGE_MEMORY or save_memory", () => {
    const toolsDefault = registerMemoryTool("user-1");
    expect(toolsDefault.save_memory).toBeDefined();

    const toolsSelected = registerMemoryTool("user-1", [
      INTERNAL_TOOL_IDS.MANAGE_MEMORY,
    ]);
    expect(toolsSelected.save_memory).toBeDefined();

    const toolsByName = registerMemoryTool("user-1", ["save_memory"]);
    expect(toolsByName.save_memory).toBeDefined();
  });

  it("executes save_memory and calls saveMemoryForUser with trimmed content", async () => {
    mockSaveMemoryForUser.mockResolvedValue({
      id: "mem-123",
      content: "User prefers bun",
    });

    const tools = registerMemoryTool("user-1");
    const result = await tools.save_memory.execute({
      content: "   User prefers bun   ",
    });

    expect(mockSaveMemoryForUser).toHaveBeenCalledWith(
      "user-1",
      "User prefers bun",
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("User prefers bun");
  });

  it("handles empty content defensively", async () => {
    const tools = registerMemoryTool("user-1");
    const result = await tools.save_memory.execute({
      content: "   ",
    });

    expect(result.success).toBe(false);
    expect(mockSaveMemoryForUser).not.toHaveBeenCalled();
  });

  it("catches Error thrown by saveMemoryForUser and returns error message", async () => {
    mockSaveMemoryForUser.mockRejectedValue(new Error("Database disconnected"));

    const tools = registerMemoryTool("user-1");
    const result = await tools.save_memory.execute({
      content: "Valid preference",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database disconnected");
  });

  it("catches non-Error thrown by saveMemoryForUser and returns fallback error message", async () => {
    mockSaveMemoryForUser.mockRejectedValue("String exception");

    const tools = registerMemoryTool("user-1");
    const result = await tools.save_memory.execute({
      content: "Valid preference",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to save memory.");
  });
});
