import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListMemories } = vi.hoisted(() => ({
  mockListMemories: vi.fn(),
}));

vi.mock("@/actions/memories/list-memories", () => ({
  listMemories: () => mockListMemories(),
}));

import { useAppStore } from "@/lib/store";

describe("EntitySlice Memory State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads memories into store using loadMemories", async () => {
    const mockMemories = [
      {
        id: "mem-1",
        userId: "user-1",
        content: "Prefers TypeScript",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockListMemories.mockResolvedValue(mockMemories);

    await useAppStore.getState().loadMemories();

    expect(useAppStore.getState().memories).toEqual(mockMemories);
    expect(useAppStore.getState().loadError).toBeNull();
  });

  it("optimistically adds, updates, and deletes memory in store", () => {
    const mem = {
      id: "mem-test",
      userId: "user-1",
      content: "Initial content",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    useAppStore.getState().addMemory(mem);
    expect(
      useAppStore.getState().memories.find((m) => m.id === "mem-test"),
    ).toBeDefined();

    useAppStore.getState().updateMemory({
      ...mem,
      content: "Updated content",
    });
    expect(
      useAppStore.getState().memories.find((m) => m.id === "mem-test")?.content,
    ).toBe("Updated content");

    useAppStore.getState().removeMemory("mem-test");
    expect(
      useAppStore.getState().memories.find((m) => m.id === "mem-test"),
    ).toBeUndefined();
  });
});

