const mockToggleDefaultAutoApprove = vi.hoisted(() => vi.fn());
const mockUpdateUserSettingsState = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockSetTab = vi.hoisted(() => vi.fn());

let currentQueryTab = "prompt";
let mockUserSettings: { defaultAutoApprove?: boolean } | null = null;

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => ({
      withOptions: () => ({}),
    }),
  },
  useQueryState: () => [
    currentQueryTab,
    (next: string) => {
      currentQueryTab = next;
      mockSetTab(next);
    },
  ],
}));

vi.mock("@/actions/user-settings/toggle-default-auto-approve", () => ({
  toggleDefaultAutoApprove: mockToggleDefaultAutoApprove,
}));

vi.mock("@/components/settings/global-prompt-form", () => ({
  GlobalPromptForm: () => <div data-testid="global-prompt-form" />,
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (
    selector: (s: {
      userSettings: typeof mockUserSettings;
      updateUserSettingsState: typeof mockUpdateUserSettingsState;
    }) => unknown,
  ) =>
    selector({
      userSettings: mockUserSettings,
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
import { GeneralSettingsTabs } from "@/components/settings/general-settings-tabs";

describe("GeneralSettingsTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentQueryTab = "prompt";
    mockUserSettings = null;
  });

  it("renders GlobalPromptForm on the default prompt tab", () => {
    render(<GeneralSettingsTabs initialSettings={{}} />);

    expect(screen.getByTestId("global-prompt-form")).toBeInTheDocument();
  });

  it("toggles defaultAutoApprove on the auto-approve tab and handles success and error", async () => {
    currentQueryTab = "auto-approve";
    mockUserSettings = { defaultAutoApprove: false };
    mockToggleDefaultAutoApprove.mockResolvedValueOnce({
      ok: true,
      value: { defaultAutoApprove: true },
    });

    render(<GeneralSettingsTabs initialSettings={{ defaultAutoApprove: false }} />);

    const defaultSwitch = screen.getByRole("switch", {
      name: "Auto-approve by default for all chats",
    });
    expect(defaultSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(defaultSwitch);

    await waitFor(() => {
      expect(mockToggleDefaultAutoApprove).toHaveBeenCalledWith(true);
    });
    expect(mockUpdateUserSettingsState).toHaveBeenCalledWith({
      defaultAutoApprove: true,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Auto-approve enabled by default for all chats",
    );

    mockToggleDefaultAutoApprove.mockResolvedValueOnce({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Toggle failed" },
    });

    fireEvent.click(defaultSwitch);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Toggle failed");
    });
  });

  it("shows disabled toast when turning off defaultAutoApprove", async () => {
    currentQueryTab = "auto-approve";
    mockUserSettings = { defaultAutoApprove: true };
    mockToggleDefaultAutoApprove.mockResolvedValueOnce({
      ok: true,
      value: { defaultAutoApprove: false },
    });

    render(<GeneralSettingsTabs initialSettings={{ defaultAutoApprove: true }} />);

    const defaultSwitch = screen.getByRole("switch", {
      name: "Auto-approve by default for all chats",
    });
    expect(defaultSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.click(defaultSwitch);

    await waitFor(() => {
      expect(mockToggleDefaultAutoApprove).toHaveBeenCalledWith(false);
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Auto-approve disabled by default",
    );
  });
});
