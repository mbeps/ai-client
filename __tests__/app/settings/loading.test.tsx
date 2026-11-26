import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsLoading from "@/app/settings/loading";

vi.mock("@/components/skeletons/settings-page-skeleton", () => ({
  SettingsPageSkeleton: () => <div data-testid="settings-page-skeleton" />,
}));

describe("SettingsLoading", () => {
  it("renders SettingsPageSkeleton", () => {
    render(<SettingsLoading />);
    expect(screen.getByTestId("settings-page-skeleton")).toBeInTheDocument();
  });
});
