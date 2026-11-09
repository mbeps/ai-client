import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShellSkeleton } from "@/components/skeletons/app-shell-skeleton";
import { CardGridSkeleton } from "@/components/skeletons/card-grid-skeleton";
import { ChatPageSkeleton } from "@/components/skeletons/chat-page-skeleton";
import { EntityDetailSkeleton } from "@/components/skeletons/entity-detail-skeleton";
import { SettingsPageSkeleton } from "@/components/skeletons/settings-page-skeleton";
import { TableListSkeleton } from "@/components/skeletons/table-list-skeleton";

describe("Skeleton Components", () => {
  it("renders AppShellSkeleton with sidebar, header, and content placeholders", () => {
    render(<AppShellSkeleton />);
    const shell = screen.getByTestId("app-shell-skeleton");
    expect(shell).toBeInTheDocument();
    expect(shell.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(5);
  });

  it("renders CardGridSkeleton with configurable count and columns", () => {
    const { rerender } = render(<CardGridSkeleton count={4} columns={2} />);
    const grid = screen.getByTestId("card-grid-skeleton");
    expect(grid).toBeInTheDocument();

    rerender(<CardGridSkeleton count={6} columns={3} />);
    expect(grid).toBeInTheDocument();
  });

  it("renders EntityDetailSkeleton with header and card form placeholders", () => {
    render(<EntityDetailSkeleton />);
    const detail = screen.getByTestId("entity-detail-skeleton");
    expect(detail).toBeInTheDocument();
  });

  it("renders ChatPageSkeleton with header, message bubbles, and composer", () => {
    render(<ChatPageSkeleton />);
    const chat = screen.getByTestId("chat-page-skeleton");
    expect(chat).toBeInTheDocument();
  });

  it("renders TableListSkeleton with default and custom row counts", () => {
    const { container, rerender } = render(<TableListSkeleton rows={3} />);
    const table = screen.getByTestId("table-list-skeleton");
    expect(table).toBeInTheDocument();
    const rows = container.querySelectorAll(".border-border.divide-border > div");
    expect(rows).toHaveLength(3);

    rerender(<TableListSkeleton rows={5} />);
    const updatedRows = container.querySelectorAll(".border-border.divide-border > div");
    expect(updatedRows).toHaveLength(5);
  });

  it("renders SettingsPageSkeleton with page header and form placeholders", () => {
    render(<SettingsPageSkeleton />);
    const settings = screen.getByTestId("settings-page-skeleton");
    expect(settings).toBeInTheDocument();
  });
});
