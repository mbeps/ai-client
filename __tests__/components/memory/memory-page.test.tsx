import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadMemories,
  mockLoadUserSettings,
  mockUpdateUserSettingsState,
  mockToggleMemoryEnabled,
  mockMemories,
  mockUserSettings,
} = vi.hoisted(() => ({
  mockLoadMemories: vi.fn(),
  mockLoadUserSettings: vi.fn(),
  mockUpdateUserSettingsState: vi.fn(),
  mockToggleMemoryEnabled: vi.fn(),
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

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: any) =>
    selector({
      memories: mockMemories,
      loadMemories: mockLoadMemories,
      removeMemory: vi.fn(),
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
});
