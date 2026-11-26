import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderSettingsClient } from "@/components/settings/providers/provider-settings-client";

const {
  mockGetUserSettings,
  mockUseProviders,
  mockUseUserModels,
  mockSetTab,
  mockRefreshProviders,
  mockRefreshModels,
} = vi.hoisted(() => ({
  mockGetUserSettings: vi.fn(),
  mockUseProviders: vi.fn(),
  mockUseUserModels: vi.fn(),
  mockSetTab: vi.fn(),
  mockRefreshProviders: vi.fn(),
  mockRefreshModels: vi.fn(),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => ({
      withOptions: () => ({}),
    }),
  },
  useQueryState: () => ["providers", mockSetTab],
}));

vi.mock("@/actions/user-settings/get-user-settings", () => ({
  getUserSettings: mockGetUserSettings,
}));

vi.mock("@/hooks/use-providers", () => ({
  useProviders: mockUseProviders,
}));

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: mockUseUserModels,
}));

vi.mock("@/components/settings/providers/provider-list", () => ({
  ProviderList: ({ onRefresh }: { onRefresh: () => Promise<void> }) => (
    <button type="button" data-testid="refresh-btn" onClick={() => void onRefresh()}>
      Refresh
    </button>
  ),
}));

vi.mock("@/components/settings/providers/model-table", () => ({
  ModelTable: () => <div data-testid="model-table" />,
}));

vi.mock("@/components/settings/providers/default-model-picker", () => ({
  DefaultModelPicker: ({ settings }: { settings: unknown }) => (
    <div data-testid="default-model-picker">{settings ? "has-settings" : "no-settings"}</div>
  ),
}));

vi.mock("@/components/settings/providers/import-export-panel", () => ({
  ImportExportPanel: () => <div data-testid="import-export-panel" />,
}));

describe("ProviderSettingsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshProviders.mockResolvedValue(undefined);
    mockRefreshModels.mockResolvedValue(undefined);
    mockUseProviders.mockReturnValue({
      providers: [],
      isLoading: false,
      refresh: mockRefreshProviders,
    });
    mockUseUserModels.mockReturnValue({
      rawModels: [],
      models: [],
      isLoading: false,
      refresh: mockRefreshModels,
    });
  });

  it("renders tabs and does not show loading overlay when not loading", () => {
    render(<ProviderSettingsClient initialSettings={null} />);

    expect(screen.getByText("Providers")).toBeInTheDocument();
    expect(screen.getByText("Models")).toBeInTheDocument();
    expect(screen.getByText("Defaults")).toBeInTheDocument();
    expect(screen.getByText("Registry")).toBeInTheDocument();
    expect(screen.queryByText("Syncing registry...")).not.toBeInTheDocument();
  });

  it("shows loading overlay when providersLoading or modelsLoading is true", () => {
    mockUseProviders.mockReturnValue({
      providers: [],
      isLoading: true,
      refresh: mockRefreshProviders,
    });

    const { rerender } = render(<ProviderSettingsClient initialSettings={null} />);
    expect(screen.getByText("Syncing registry...")).toBeInTheDocument();

    mockUseProviders.mockReturnValue({
      providers: [],
      isLoading: false,
      refresh: mockRefreshProviders,
    });
    mockUseUserModels.mockReturnValue({
      rawModels: [],
      models: [],
      isLoading: true,
      refresh: mockRefreshModels,
    });
    rerender(<ProviderSettingsClient initialSettings={null} />);
    expect(screen.getByText("Syncing registry...")).toBeInTheDocument();
  });

  it("refreshes all data and updates settings on ok and non-ok responses", async () => {
    mockGetUserSettings.mockResolvedValueOnce({
      ok: true,
      value: { id: "s1" },
    });

    render(<ProviderSettingsClient initialSettings={null} />);

    fireEvent.click(screen.getByTestId("refresh-btn"));

    await waitFor(() => {
      expect(mockGetUserSettings).toHaveBeenCalledTimes(1);
      expect(mockRefreshProviders).toHaveBeenCalledTimes(1);
      expect(mockRefreshModels).toHaveBeenCalledTimes(1);
    });

    mockGetUserSettings.mockResolvedValueOnce({
      ok: false,
      error: { message: "Failed" },
    });

    fireEvent.click(screen.getByTestId("refresh-btn"));

    await waitFor(() => {
      expect(mockGetUserSettings).toHaveBeenCalledTimes(2);
    });
  });
});
