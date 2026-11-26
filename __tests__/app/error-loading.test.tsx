import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RootError from "@/app/error";
import RootLoading from "@/app/loading";
import ProjectError from "@/app/(main)/projects/[id]/error";

vi.mock("@/components/shared/error-page", () => ({
  ErrorPage: ({ heading }: { heading: string }) => (
    <div data-testid="error-page">{heading}</div>
  ),
}));

vi.mock("@/components/skeletons/app-shell-skeleton", () => ({
  AppShellSkeleton: () => <div data-testid="app-shell-skeleton" />,
}));

describe("RootError and RootLoading", () => {
  it("renders RootError with ErrorPage", () => {
    render(<RootError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByTestId("error-page")).toHaveTextContent(
      "Something went wrong",
    );
  });

  it("renders RootLoading with AppShellSkeleton", () => {
    render(<RootLoading />);
    expect(screen.getByTestId("app-shell-skeleton")).toBeInTheDocument();
  });

  it("renders ProjectError with ErrorPage", () => {
    render(<ProjectError error={new Error("db fail")} reset={vi.fn()} />);
    expect(screen.getByTestId("error-page")).toHaveTextContent(
      "Failed to load project",
    );
  });
});
