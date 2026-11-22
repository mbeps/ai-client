const mockUpdateInternalToolApproval = vi.hoisted(() => vi.fn());
const mockLoadUserSettings = vi.hoisted(() => vi.fn());
const mockUpdateUserSettingsState = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

let mockUserSettings: { internalToolApprovals: string | null } | null = null;

vi.mock("@/actions/user-settings/update-internal-tool-approval", () => ({
  updateInternalToolApproval: mockUpdateInternalToolApproval,
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (
    selector: (s: {
      userSettings: typeof mockUserSettings;
      loadUserSettings: typeof mockLoadUserSettings;
      updateUserSettingsState: typeof mockUpdateUserSettingsState;
    }) => unknown,
  ) =>
    selector({
      userSettings: mockUserSettings,
      loadUserSettings: mockLoadUserSettings,
      updateUserSettingsState: mockUpdateUserSettingsState,
    }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InternalToolsGrid } from "@/components/settings/internal-tools-grid";
import { groupToolsByCategory } from "@/config/tools";

describe("InternalToolsGrid", () => {
  const groups = groupToolsByCategory();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserSettings = null;
    mockLoadUserSettings.mockResolvedValue(undefined);
  });

  it("loads userSettings on mount when null", () => {
    render(<InternalToolsGrid groups={groups} />);
    expect(mockLoadUserSettings).toHaveBeenCalledTimes(1);
  });

  it("applies overrides from userSettings and updates approval on toggle", async () => {
    mockUserSettings = {
      internalToolApprovals: JSON.stringify({ create_skill: "auto" }),
    };
    mockUpdateInternalToolApproval.mockResolvedValue({
      ok: true,
      value: { internalToolApprovals: null },
    });

    render(<InternalToolsGrid groups={groups} />);

    expect(mockLoadUserSettings).not.toHaveBeenCalled();

    // create_skill is overridden to auto, so clicking toggles it back to ask
    const toggle = screen.getByRole("button", { name: "Create Skill approval" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockUpdateInternalToolApproval).toHaveBeenCalledWith({
        toolName: "create_skill",
        approval: "ask",
      });
    });
    expect(mockUpdateUserSettingsState).toHaveBeenCalledWith({
      internalToolApprovals: null,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Tool set to require approval",
    );
  });

  it("shows success toast for auto-approve and error toast on failure", async () => {
    mockUserSettings = { internalToolApprovals: null };
    mockUpdateInternalToolApproval.mockResolvedValueOnce({
      ok: true,
      value: { internalToolApprovals: JSON.stringify({ create_skill: "auto" }) },
    });

    render(<InternalToolsGrid groups={groups} />);

    const toggle = screen.getByRole("button", { name: "Create Skill approval" });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Tool set to auto-approve");
    });

    mockUpdateInternalToolApproval.mockResolvedValueOnce({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to save" },
    });

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to save");
    });
  });
});
