import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Memory } from "@/types/memory";

const {
  mockLoadMemories,
  mockLoadUserSettings,
  mockRemoveMemories,
  mockUpdateUserSettingsState,
  mockDeleteMemories,
  mockToggleMemoryEnabled,
  mockToast,
  mockStoreState,
} = vi.hoisted(() => ({
  mockLoadMemories: vi.fn(),
  mockLoadUserSettings: vi.fn(),
  mockRemoveMemories: vi.fn(),
  mockUpdateUserSettingsState: vi.fn(),
  mockDeleteMemories: vi.fn(),
  mockToggleMemoryEnabled: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockStoreState: {
    memories: [] as Memory[],
    loadMemories: vi.fn(),
    removeMemories: vi.fn(),
    memoriesLoading: false,
    memoriesError: null as string | null,
    userSettings: null as { memoryEnabled?: boolean } | null,
    loadUserSettings: vi.fn(),
    updateUserSettingsState: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/actions/memories/delete-memories", () => ({
  deleteMemories: mockDeleteMemories,
}));

vi.mock("@/actions/user-settings/toggle-memory-enabled", () => ({
  toggleMemoryEnabled: mockToggleMemoryEnabled,
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: any) => any) => selector(mockStoreState),
}));

vi.mock("@/components/shared/resource-list-page", () => ({
  ResourceListPage: ({
    items,
    renderCard,
    action,
    headerActions,
    extraFilters,
    onMount,
  }: any) => {
    onMount?.();
    return (
      <div data-testid="resource-list-page">
        <div data-testid="header-actions-slot">{headerActions}</div>
        <div data-testid="action-slot">{action}</div>
        <div data-testid="extra-filters-slot">{extraFilters}</div>
        <div data-testid="items-slot">
          {items.map((item: any) => (
            <div key={item.id}>{renderCard(item)}</div>
          ))}
        </div>
      </div>
    );
  },
}));

vi.mock("@/components/memory/memory-card", () => ({
  MemoryCard: ({
    memory,
    isSelected,
    onToggleSelect,
    onEdit,
    onDelete,
  }: any) => (
    <div data-testid={`memory-card-${memory.id}`} data-selected={String(isSelected)}>
      <span>{memory.content}</span>
      <button type="button" onClick={() => onToggleSelect(memory)}>
        Toggle-{memory.id}
      </button>
      <button type="button" onClick={() => onEdit(memory)}>
        Edit-{memory.id}
      </button>
      <button type="button" onClick={() => onDelete(memory)}>
        Delete-{memory.id}
      </button>
    </div>
  ),
}));

vi.mock("@/components/memory/memory-dialog", () => ({
  MemoryDialog: ({ open, memory }: any) => (
    <div data-testid="memory-dialog" data-open={String(open)} data-editing={memory?.id ?? ""} />
  ),
}));

vi.mock("@/components/shared/delete-confirmation-dialog", () => ({
  DeleteConfirmationDialog: ({ open, onConfirm, title }: any) =>
    open ? (
      <div data-testid="delete-dialog">
        <span>{title}</span>
        <button type="button" onClick={onConfirm}>
          Confirm Delete
        </button>
      </div>
    ) : null,
}));

import MemoryPage from "@/app/settings/memory/page";

const mem1: Memory = {
  id: "m1",
  userId: "u1",
  content: "Likes TypeScript",
  category: "preference",
  source: "manual",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const mem2: Memory = {
  id: "m2",
  userId: "u1",
  content: "Uses Vitest",
  category: "fact",
  source: "auto",
  createdAt: new Date("2026-01-02"),
  updatedAt: new Date("2026-01-02"),
};

describe("MemoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.memories = [mem1, mem2];
    mockStoreState.loadMemories = mockLoadMemories;
    mockStoreState.removeMemories = mockRemoveMemories;
    mockStoreState.loadUserSettings = mockLoadUserSettings;
    mockStoreState.updateUserSettingsState = mockUpdateUserSettingsState;
    mockStoreState.userSettings = null;
  });

  it("handles selecting, deselecting, select all, and deselect all", () => {
    render(<MemoryPage />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle-m1" }));
    expect(screen.getByTestId("memory-card-m1")).toHaveAttribute("data-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "Toggle-m1" }));
    expect(screen.getByTestId("memory-card-m1")).toHaveAttribute("data-selected", "false");

    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    expect(screen.getByTestId("memory-card-m1")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("memory-card-m2")).toHaveAttribute("data-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: /deselect all/i }));
    expect(screen.getByTestId("memory-card-m1")).toHaveAttribute("data-selected", "false");
  });

  it("opens add and edit memory dialogs", () => {
    render(<MemoryPage />);

    fireEvent.click(screen.getByRole("button", { name: /add memory/i }));
    expect(screen.getByTestId("memory-dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("memory-dialog")).toHaveAttribute("data-editing", "");

    fireEvent.click(screen.getByRole("button", { name: "Edit-m1" }));
    expect(screen.getByTestId("memory-dialog")).toHaveAttribute("data-editing", "m1");
  });

  it("deletes single and bulk memories and handles errors", async () => {
    mockDeleteMemories.mockResolvedValue({ ok: true, value: undefined });
    render(<MemoryPage />);

    // Single delete
    fireEvent.click(screen.getByRole("button", { name: "Delete-m1" }));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockDeleteMemories).toHaveBeenCalledWith({ ids: ["m1"] });
      expect(mockRemoveMemories).toHaveBeenCalledWith(["m1"]);
      expect(mockToast.success).toHaveBeenCalledWith("Memory deleted");
    });

    // Bulk delete
    fireEvent.click(screen.getByRole("button", { name: "Toggle-m1" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle-m2" }));
    fireEvent.click(screen.getByRole("button", { name: /delete selected/i }));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockDeleteMemories).toHaveBeenCalledWith({ ids: ["m1", "m2"] });
      expect(mockToast.success).toHaveBeenCalledWith("2 memories deleted");
    });

    // !ok with message and fallback
    mockDeleteMemories.mockResolvedValueOnce({
      ok: false,
      error: { message: "Delete failed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete-m1" }));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Delete failed");
    });

    mockDeleteMemories.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete-m1" }));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete memories");
    });

    // throws Error and non-Error
    mockDeleteMemories.mockRejectedValueOnce(new Error("DB error"));
    fireEvent.click(screen.getByRole("button", { name: "Delete-m1" }));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("DB error");
    });

    mockDeleteMemories.mockRejectedValueOnce("unknown");
    fireEvent.click(screen.getByRole("button", { name: "Delete-m1" }));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete memories");
    });
  });

  it("renders empty state when memories list is empty", () => {
    mockStoreState.memories = [];
    render(<MemoryPage />);
    expect(screen.getByTestId("extra-filters-slot")).toBeEmptyDOMElement();
  });

  it("toggles memory enabled setting and handles errors", async () => {
    mockStoreState.userSettings = { memoryEnabled: false };
    mockToggleMemoryEnabled.mockResolvedValueOnce({ ok: true, value: undefined });
    render(<MemoryPage />);

    const switchEl = screen.getByRole("switch");
    fireEvent.click(switchEl);

    await waitFor(() => {
      expect(mockToggleMemoryEnabled).toHaveBeenCalledWith(true);
      expect(mockToast.success).toHaveBeenCalledWith("Memory enabled");
    });

    mockToggleMemoryEnabled.mockResolvedValueOnce({
      ok: false,
      error: { message: "Toggle error" },
    });
    fireEvent.click(switchEl);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Toggle error");
    });

    mockToggleMemoryEnabled.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    fireEvent.click(switchEl);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to update memory setting");
    });

    mockToggleMemoryEnabled.mockRejectedValueOnce(new Error("Network"));
    fireEvent.click(switchEl);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Network");
    });

    mockToggleMemoryEnabled.mockRejectedValueOnce("boom");
    fireEvent.click(switchEl);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to update memory setting");
    });
  });
});
