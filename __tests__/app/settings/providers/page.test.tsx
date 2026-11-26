import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProviderSettingsPage from "@/app/settings/providers/page";

const mockRequireSession = vi.hoisted(() => vi.fn());
const mockGetUserSettings = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/actions/user-settings/get-user-settings", () => ({
  getUserSettings: mockGetUserSettings,
}));

vi.mock("@/components/page-header", () => ({
  PageHeader: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock("@/components/settings/providers/provider-settings-client", () => ({
  ProviderSettingsClient: ({ initialSettings }: { initialSettings: unknown }) => (
    <div data-testid="provider-settings-client" data-settings={JSON.stringify(initialSettings)} />
  ),
}));

vi.mock("@/components/shared/page-container", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-container">{children}</div>
  ),
}));

describe("ProviderSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("renders ProviderSettingsClient with fetched settings when getUserSettings succeeds", async () => {
    mockGetUserSettings.mockResolvedValue({
      ok: true,
      value: { defaultModelId: "gpt-4o" },
    });

    const ui = await ProviderSettingsPage();
    render(ui);

    expect(mockRequireSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Providers")).toBeInTheDocument();
    expect(screen.getByTestId("provider-settings-client")).toHaveAttribute(
      "data-settings",
      JSON.stringify({ defaultModelId: "gpt-4o" }),
    );
  });

  it("renders ProviderSettingsClient with null when getUserSettings fails", async () => {
    mockGetUserSettings.mockResolvedValue({
      ok: false,
      error: "Failed",
    });

    const ui = await ProviderSettingsPage();
    render(ui);

    expect(screen.getByTestId("provider-settings-client")).toHaveAttribute(
      "data-settings",
      "null",
    );
  });
});
