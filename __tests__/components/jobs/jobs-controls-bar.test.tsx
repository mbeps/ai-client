import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobsControlsBar } from "@/components/jobs/jobs-controls-bar";

describe("JobsControlsBar", () => {
  it("renders clear search button when searchQuery is non-empty and clears on click", () => {
    const onSearchChange = vi.fn();
    render(
      <JobsControlsBar
        searchQuery="index"
        onSearchChange={onSearchChange}
        activeTab="all"
        onTabChange={vi.fn()}
        counts={{ running: 0, queued: 0, completed: 0, failed: 0, all: 1 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onSearchChange).toHaveBeenCalledWith("");
  });
});
