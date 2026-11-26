import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsLayout from "@/app/settings/layout";

vi.mock("@/components/shared/authenticated-layout", () => ({
  AuthenticatedLayout: ({
    children,
    sidebar,
  }: {
    children: React.ReactNode;
    sidebar: React.ReactNode;
  }) => (
    <div data-testid="authenticated-layout">
      <div data-testid="sidebar-slot">{sidebar}</div>
      <div data-testid="children-slot">{children}</div>
    </div>
  ),
}));

vi.mock("@/components/sidebar/settings-sidebar", () => ({
  SettingsSidebar: () => <nav data-testid="settings-sidebar" />,
}));

describe("SettingsLayout", () => {
  it("renders AuthenticatedLayout with SettingsSidebar and children", () => {
    render(
      <SettingsLayout>
        <div data-testid="child-content">Settings Content</div>
      </SettingsLayout>,
    );

    expect(screen.getByTestId("authenticated-layout")).toBeInTheDocument();
    expect(screen.getByTestId("settings-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toHaveTextContent("Settings Content");
  });
});
