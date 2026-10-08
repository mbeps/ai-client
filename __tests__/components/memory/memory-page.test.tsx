import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadMemories,
  mockLoadUserSettings,
  mockUpdateUserSettingsState,
  mockToggleMemoryEnabled,
  mockDeleteMemories,
  mockRemoveMemories,
  mockMemories,
  mockUserSettings,
} = vi.hoisted(() => ({
  mockLoadMemories: vi.fn(),
  mockLoadUserSettings: vi.fn(),
  mockUpdateUserSettingsState: vi.fn(),
  mockToggleMemoryEnabled: vi.fn(),
  mockDeleteMemories: vi.fn(),
  mockRemoveMemories: vi.fn(),
  mockUserSettings: { memoryEnabled: true } as { memoryEnabled: boolean },
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

vi.mock("@/actions/user-settings/toggle-memory-enabled", () => ({
  toggleMemoryEnabled: (enabled: boolean) => mockToggleMemoryEnabled(enabled),
}));

vi.mock("@/actions/memories/delete-memories", () => ({
  deleteMemories: (input: any) => mockDeleteMemories(input),
}));

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: any) =>
    selector({
      memories: mockMemories,
      loadMemories: mockLoadMemories,
      removeMemories: mockRemoveMemories,
      userSettings: mockUserSettings,
      loadUserSettings: mockLoadUserSettings,
      updateUserSettingsState: mockUpdateUserSettingsState,
      loadError: null,
    }),
}));

import MemoryPage from "@/app/settings/memory/page";

describe("MemoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserSettings.memoryEnabled = true;
    mockToggleMemoryEnabled.mockResolvedValue({ memoryEnabled: false });
    mockDeleteMemories.mockResolvedValue({ success: true, count: 2 });
  });

  it("calls loadMemories and loadUserSettings on mount and renders list of memories", () => {
    render(<MemoryPage />);

    expect(mockLoadMemories).toHaveBeenCalled();
    expect(mockLoadUserSettings).toHaveBeenCalled();
    expect(screen.getByText("Uses Arch Linux")).toBeInTheDocument();
    expect(screen.getByText("Prefers concise code")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("filters memories by content query", async () => {
    const user = userEvent.setup();
    render(<MemoryPage />);

    const searchInput = screen.getByPlaceholderText(/search memories/i);
    await user.type(searchInput, "Arch");

    expect(screen.getByText("Uses Arch Linux")).toBeInTheDocument();
    expect(screen.queryByText("Prefers concise code")).not.toBeInTheDocument();
  });

  it("toggles memory enabled status when switch is clicked", async () => {
    const user = userEvent.setup();
    render(<MemoryPage />);

    const switchBtn = screen.getByRole("switch", { name: /toggle memory/i });
    expect(switchBtn).toBeChecked();

    await user.click(switchBtn);

    expect(mockUpdateUserSettingsState).toHaveBeenCalledWith({
      memoryEnabled: false,
    });
    expect(mockToggleMemoryEnabled).toHaveBeenCalledWith(false);
  });

  it("handles multi-selection and bulk deletion", async () => {
    const user = userEvent.setup();
    render(<MemoryPage />);

    // Click select all
    const selectAllBtn = screen.getByRole("button", { name: /select all/i });
    await user.click(selectAllBtn);

    // Verify selected count badge and delete button
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    const deleteSelectedBtn = screen.getByRole("button", {
      name: /delete selected/i,
    });
    await user.click(deleteSelectedBtn);

    // Dialog should show confirmation
    expect(
      screen.getByText(/Are you sure you want to delete 2 memories\?/i),
    ).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);

    expect(mockDeleteMemories).toHaveBeenCalledWith({
      ids: ["mem-1", "mem-2"],
    });
    expect(mockRemoveMemories).toHaveBeenCalledWith(["mem-1", "mem-2"]);
  });

  it("handles single item deletion via unified deleteMemories", async () => {
    const user = userEvent.setup();
    render(<MemoryPage />);

    // Click single item delete (first card is mem-2 because sortByUpdatedAt orders mem-2 2026-01-02 ahead of mem-1 2026-01-01)
    const deleteBtns = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteBtns[0]);

    // Confirm dialog
    expect(
      screen.getByText(/Are you sure you want to delete this memory\?/i),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);

    expect(mockDeleteMemories).toHaveBeenCalledWith({
      ids: ["mem-2"],
    });
    expect(mockRemoveMemories).toHaveBeenCalledWith(["mem-2"]);
  });
});
