import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/sidebar/nav-sidebar-shell", () => ({
  NavSidebarShell: ({
    headerContent,
    navigation,
    isItemActive,
  }: {
    headerContent: React.ReactNode;
    navigation: Array<{ name: string; href: string }>;
    isItemActive: (item: { name: string; href: string }, pathname: string) => boolean;
  }) => (
    <div>
      {headerContent}
      {navigation.map((item) => (
        <div key={item.name} data-testid={`item-${item.name}`}>
          {String(isItemActive(item, item.href))}-
          {String(isItemActive(item, `${item.href}/sub`))}-
          {String(isItemActive(item, "/other"))}
        </div>
      ))}
    </div>
  ),
}));

import { SettingsSidebar } from "@/components/sidebar/settings-sidebar";

describe("SettingsSidebar", () => {
  it("renders header and evaluates isItemActive for exact, prefix, and non-matching routes", () => {
    render(<SettingsSidebar />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByTestId("item-General").textContent).toBe(
      "true-false-false",
    );
    expect(screen.getByTestId("item-Connectors").textContent).toBe(
      "true-true-false",
    );
  });
});
