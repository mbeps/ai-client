import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoadMemories, mockMemories } = vi.hoisted(() => ({
  mockLoadMemories: vi.fn(),
  mockMemories: [
    {
      id: "mem-1",
      userId: "user-1",
      content: "Uses Arch Linux",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    {
      id: "mem-2",
      userId: "user-1",
      content: "Prefers concise code",
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
    },
  ],
}));

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: any) =>
    selector({
      memories: mockMemories,
      loadMemories: mockLoadMemories,
      removeMemory: vi.fn(),
      loadError: null,
    }),
}));

import MemoryPage from "@/app/settings/memory/page";

describe("MemoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls loadMemories on mount and renders list of memories", () => {
    render(<MemoryPage />);

    expect(mockLoadMemories).toHaveBeenCalled();
    expect(screen.getByText("Uses Arch Linux")).toBeInTheDocument();
    expect(screen.getByText("Prefers concise code")).toBeInTheDocument();
  });

  it("filters memories by content query", async () => {
    const user = userEvent.setup();
    render(<MemoryPage />);

    const searchInput = screen.getByPlaceholderText(/search memories/i);
    await user.type(searchInput, "Arch");

    expect(screen.getByText("Uses Arch Linux")).toBeInTheDocument();
    expect(screen.queryByText("Prefers concise code")).not.toBeInTheDocument();
  });
});

