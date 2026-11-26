import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobRunCard } from "@/components/jobs/job-run-card";
import type { JobItem } from "@/types/jobs/job";

describe("JobRunCard", () => {
  const baseJob: JobItem = {
    id: "job-1",
    type: "chat",
    title: "Test Job",
    subtitle: "Sub",
    status: "COMPLETED",
    functionName: "fn",
    queuedAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:01.000Z",
    endedAt: "2026-01-01T00:00:02.000Z",
    durationMs: 500,
    isTargetDeleted: false,
  };

  it("renders millisecond duration, CANCELLED status, and unknown job type fallback", () => {
    render(
      <JobRunCard
        job={{
          ...baseJob,
          type: "unknown" as any,
          status: "CANCELLED",
          durationMs: 500,
        }}
        cancellingIds={new Set()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/500ms/)).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Workflow")).toBeInTheDocument();
  });

  it("handles missing timing and invalid date string", () => {
    const { rerender } = render(
      <JobRunCard
        job={{
          ...baseJob,
          startedAt: null,
          queuedAt: null,
        }}
        cancellingIds={new Set()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Test Job")).toBeInTheDocument();

    rerender(
      <JobRunCard
        job={{
          ...baseJob,
          startedAt: "not-a-date",
        }}
        cancellingIds={new Set()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("started not-a-date")).toBeInTheDocument();
  });
});
