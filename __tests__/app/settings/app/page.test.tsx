import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/app/page";

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

vi.mock("@/components/settings/general-settings-tabs", () => ({
  GeneralSettingsTabs: ({ initialSettings }: { initialSettings: Record<string, unknown> }) => (
    <div data-testid="general-settings-tabs" data-settings={JSON.stringify(initialSettings)} />
  ),
}));

vi.mock("@/components/shared/page-container", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-container">{children}</div>
  ),
}));

describe("app/settings/app/page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("renders GeneralSettingsTabs with fetched settings when getUserSettings succeeds", async () => {
    mockGetUserSettings.mockResolvedValue({
      ok: true,
      value: { globalPrompt: "Be concise" },
    });

    const ui = await SettingsPage();
    render(ui);

    expect(mockRequireSession).toHaveBeenCalledTimes(1);
    expect(screen.getByText("General Settings")).toBeInTheDocument();
    expect(screen.getByTestId("general-settings-tabs")).toHaveAttribute(
      "data-settings",
      JSON.stringify({ globalPrompt: "Be concise" }),
    );
  });

  it("renders GeneralSettingsTabs with empty object when getUserSettings fails", async () => {
    mockGetUserSettings.mockResolvedValue({
      ok: false,
      error: "Failed to load",
    });

    const ui = await SettingsPage();
    render(ui);

    expect(screen.getByTestId("general-settings-tabs")).toHaveAttribute("data-settings", "{}");
  });
});
