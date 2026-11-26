import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobsStatCards } from "@/components/jobs/jobs-stat-cards";
import type { JobFilter } from "@/components/jobs/jobs-filter";

describe("JobsStatCards", () => {
  it("defaults missing counts to 0", () => {
    render(
      <JobsStatCards
        activeTab="all"
        counts={{} as Record<JobFilter, number>}
        awaitingApprovalCount={0}
        onTabChange={vi.fn()}
      />,
    );

    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(4);
  });
});
