import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobsEmptyState } from "@/components/jobs/jobs-empty-state";
import {
  computeStatCounts,
  matchesJobFilter,
  matchesJobSearch,
  matchesJobTab,
  resolveActiveTab,
} from "@/components/jobs/jobs-filter";
import type { JobItem, JobStatus, JobType } from "@/types/jobs";

function createJob(overrides: Partial<JobItem> = {}): JobItem {
  return {
    id: "job-1",
    type: "chat" as JobType,
    status: "RUNNING" as JobStatus,
    title: "Test Job",
    subtitle: "Subtitle info",
    functionName: "testFunction",
    entityDeleted: false,
    ...overrides,
  };
}

describe("jobs-filter unit tests", () => {
  describe("resolveActiveTab", () => {
    it("resolves statusParam if provided", () => {
      expect(resolveActiveTab("queued", "running")).toBe("queued");
      expect(resolveActiveTab("completed", null)).toBe("completed");
      expect(resolveActiveTab("failed", null)).toBe("failed");
      expect(resolveActiveTab("cancelled", null)).toBe("failed");
      expect(resolveActiveTab("all", null)).toBe("all");
    });

    it("falls back to tabParam if statusParam is absent", () => {
      expect(resolveActiveTab(null, "queued")).toBe("queued");
      expect(resolveActiveTab(undefined, "completed")).toBe("completed");
      expect(resolveActiveTab(undefined, "all")).toBe("all");
    });

    it("defaults to running when params are empty or unknown", () => {
      expect(resolveActiveTab(null, null)).toBe("running");
      expect(resolveActiveTab("unknown", "unknown")).toBe("running");
    });
  });

  describe("matchesJobTab", () => {
    it("matches running tab", () => {
      expect(matchesJobTab("RUNNING", "running")).toBe(true);
      expect(matchesJobTab("QUEUED", "running")).toBe(false);
    });

    it("matches queued tab", () => {
      expect(matchesJobTab("QUEUED", "queued")).toBe(true);
      expect(matchesJobTab("RUNNING", "queued")).toBe(false);
    });

    it("matches completed tab", () => {
      expect(matchesJobTab("COMPLETED", "completed")).toBe(true);
      expect(matchesJobTab("FAILED", "completed")).toBe(false);
    });

    it("matches failed tab for both FAILED and CANCELLED", () => {
      expect(matchesJobTab("FAILED", "failed")).toBe(true);
      expect(matchesJobTab("CANCELLED", "failed")).toBe(true);
      expect(matchesJobTab("COMPLETED", "failed")).toBe(false);
    });

    it("matches all tab unconditionally", () => {
      expect(matchesJobTab("RUNNING", "all")).toBe(true);
      expect(matchesJobTab("QUEUED", "all")).toBe(true);
      expect(matchesJobTab("COMPLETED", "all")).toBe(true);
      expect(matchesJobTab("FAILED", "all")).toBe(true);
      expect(matchesJobTab("CANCELLED", "all")).toBe(true);
    });
  });

  describe("matchesJobSearch", () => {
    it("returns true when query is empty", () => {
      const job = createJob();
      expect(matchesJobSearch(job, "")).toBe(true);
    });

    it("matches title, type, functionName, or subtitle", () => {
      const job = createJob({
        title: "Agent Summarizer",
        type: "transform",
        functionName: "pdfExtractor",
        subtitle: "Document 123",
      });

      expect(matchesJobSearch(job, "agent")).toBe(true);
      expect(matchesJobSearch(job, "transform")).toBe(true);
      expect(matchesJobSearch(job, "pdf")).toBe(true);
      expect(matchesJobSearch(job, "123")).toBe(true);
      expect(matchesJobSearch(job, "nonexistent")).toBe(false);
    });
  });

  describe("matchesJobFilter", () => {
    it("combines tab and search matching", () => {
      const job = createJob({ status: "RUNNING", title: "Active Bot" });
      expect(matchesJobFilter(job, "running", "bot")).toBe(true);
      expect(matchesJobFilter(job, "queued", "bot")).toBe(false);
      expect(matchesJobFilter(job, "running", "other")).toBe(false);
    });
  });

  describe("computeStatCounts", () => {
    it("accurately tallies statuses", () => {
      const jobs = [
        createJob({ status: "RUNNING" }),
        createJob({ status: "RUNNING" }),
        createJob({ status: "QUEUED" }),
        createJob({ status: "COMPLETED" }),
        createJob({ status: "FAILED" }),
        createJob({ status: "CANCELLED" }),
      ];

      const counts = computeStatCounts(jobs);
      expect(counts).toEqual({
        running: 2,
        queued: 1,
        completed: 1,
        failed: 2,
        all: 6,
      });
    });

    it("handles empty jobs array", () => {
      expect(computeStatCounts([])).toEqual({
        running: 0,
        queued: 0,
        completed: 0,
        failed: 0,
        all: 0,
      });
    });
  });
});

describe("JobsEmptyState", () => {
  it("renders contextual message for empty tabs without search", () => {
    const { rerender } = render(<JobsEmptyState activeTab="running" searchQuery="" />);
    expect(screen.getByText("No running jobs")).toBeInTheDocument();

    rerender(<JobsEmptyState activeTab="queued" searchQuery="" />);
    expect(screen.getByText("No queued jobs")).toBeInTheDocument();

    rerender(<JobsEmptyState activeTab="completed" searchQuery="" />);
    expect(screen.getByText("No completed jobs")).toBeInTheDocument();

    rerender(<JobsEmptyState activeTab="failed" searchQuery="" />);
    expect(screen.getByText("No failed jobs")).toBeInTheDocument();

    rerender(<JobsEmptyState activeTab="all" searchQuery="" />);
    expect(screen.getByText("No background jobs found")).toBeInTheDocument();
  });

  it("renders search empty message when searchQuery is active", () => {
    render(<JobsEmptyState activeTab="running" searchQuery="my query" />);
    expect(screen.getByText("No matching jobs found")).toBeInTheDocument();
    expect(
      screen.getByText('No jobs matched "my query". Try a different search keyword.'),
    ).toBeInTheDocument();
  });
});

