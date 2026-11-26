import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobsEmptyState } from "@/components/jobs/jobs-empty-state";
import { JobsView } from "@/components/jobs/jobs-view";

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => ({ withOptions: () => ({}) }),
    withOptions: () => ({}),
  },
  useQueryState: vi.fn(() => [null, vi.fn()]),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/actions/jobs/list-jobs", () => ({
  listJobs: vi.fn(),
}));

vi.mock("@/actions/jobs/cancel-job", () => ({
  cancelJob: vi.fn(),
}));

vi.mock("@/actions/workflow-runs/approve-workflow-run", () => ({
  approveWorkflowRunAction: vi.fn(),
}));

vi.mock("@/actions/chats/respond-to-tool-approval", () => ({
  respondToToolApproval: vi.fn(),
}));
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

describe("JobsView", () => {
  it("handles tab toggling with statusParam, manual refresh errors, cancel errors, approval errors, and dialog close", async () => {
    const { listJobs } = await import("@/actions/jobs/list-jobs");
    const { cancelJob } = await import("@/actions/jobs/cancel-job");
    const { approveWorkflowRunAction } = await import(
      "@/actions/workflow-runs/approve-workflow-run"
    );
    const { respondToToolApproval } = await import(
      "@/actions/chats/respond-to-tool-approval"
    );
    const { toast } = await import("sonner");

    const runningJob = {
      id: "job-run-1",
      type: "workflow" as const,
      entityId: "run-1",
      title: "Workflow 1",
      status: "RUNNING" as const,
      startedAt: new Date().toISOString(),
      approval: {
        kind: "workflow-review" as const,
        runId: "run-1",
        nodeId: "node-1",
        nodeName: "Review",
      },
    };
    const toolJob = {
      id: "job-tool-1",
      type: "chat" as const,
      entityId: "chat-1",
      title: "Chat 1",
      status: "RUNNING" as const,
      startedAt: new Date().toISOString(),
      approval: {
        kind: "chat-tool" as const,
        assistantMessageId: "msg-1",
        pendingApprovals: [
          {
            approvalId: "a1",
            toolCallId: "tc1",
            toolName: "web_search",
            args: {},
          },
        ],
      },
    };

    vi.mocked(listJobs).mockResolvedValue({
      ok: true,
      value: { jobs: [runningJob, toolJob], offline: false },
    });

    render(<JobsView />);
    await vi.waitFor(() => {
      expect(screen.getByText("Workflow 1")).toBeInTheDocument();
    });

    // Manual refresh: res.ok with jobs undefined
    vi.mocked(listJobs).mockResolvedValueOnce({
      ok: true,
      value: { jobs: undefined as any, offline: false },
    });
    const refreshBtn = screen.getByRole("button", { name: /^refresh$/i });
    fireEvent.click(refreshBtn);
    await vi.waitFor(() => {
      expect(listJobs).toHaveBeenCalledTimes(2);
      expect(refreshBtn).not.toBeDisabled();
    });

    // Manual refresh: !res.ok with empty message, then custom message
    vi.mocked(listJobs).mockResolvedValueOnce({
      ok: false,
      error: { message: "" } as any,
    });
    fireEvent.click(refreshBtn);
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load jobs");
      expect(refreshBtn).not.toBeDisabled();
    });

    // Manual refresh: rejected with non-Error
    vi.mocked(listJobs).mockRejectedValueOnce("network down");
    fireEvent.click(refreshBtn);
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to load jobs");
      expect(refreshBtn).not.toBeDisabled();
    });

    // Restore jobs
    vi.mocked(listJobs).mockResolvedValue({
      ok: true,
      value: { jobs: [runningJob, toolJob], offline: false },
    });
    fireEvent.click(refreshBtn);
    await vi.waitFor(() => {
      expect(screen.getByText("Workflow 1")).toBeInTheDocument();
    });

    // Toggle tab: click Running twice to toggle back to all
    const runningTab = screen.getByRole("tab", { name: /running/i });
    fireEvent.click(runningTab);
    fireEvent.click(runningTab);

    // Workflow review reject (!res.ok then rejected with non-Error then ok with approved=false)
    vi.mocked(approveWorkflowRunAction).mockResolvedValueOnce({
      ok: false,
      error: { message: "" } as any,
    });
    const rejectBtn = screen.getByRole("button", { name: /^reject$/i });
    fireEvent.click(rejectBtn);
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to submit approval");
      expect(rejectBtn).not.toBeDisabled();
    });

    vi.mocked(approveWorkflowRunAction).mockRejectedValueOnce("boom");
    fireEvent.click(rejectBtn);
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to submit approval");
      expect(rejectBtn).not.toBeDisabled();
    });

    vi.mocked(approveWorkflowRunAction).mockResolvedValueOnce({
      ok: true,
      value: undefined as any,
    });
    fireEvent.click(rejectBtn);
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Run rejected and stopped");
    });

    // Tool approval !res.ok
    vi.mocked(respondToToolApproval).mockResolvedValueOnce({
      ok: false,
      error: { message: "" } as any,
    });
    const approveButtons = screen.getAllByRole("button", { name: /^approve$/i });
    fireEvent.click(approveButtons[approveButtons.length - 1]);
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to submit tool approval");
    });

    // Cancel job dialog: open, close via Cancel, reopen, fail with !res.ok and non-Error
    const cancelButtons = screen.getAllByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: /keep running/i }));

    fireEvent.click(cancelButtons[0]);
    vi.mocked(cancelJob).mockResolvedValueOnce({
      ok: false,
      error: { message: "" } as any,
    });
    fireEvent.click(screen.getByRole("button", { name: /cancel job/i }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to cancel job");
    });

    fireEvent.click(cancelButtons[0]);
    vi.mocked(cancelJob).mockRejectedValueOnce("cancel boom");
    fireEvent.click(screen.getByRole("button", { name: /cancel job/i }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to cancel job");
    });
  });

  it("clears statusParam on tab change and shows Error message on cancelJob rejection", async () => {
    const { listJobs } = await import("@/actions/jobs/list-jobs");
    const { cancelJob } = await import("@/actions/jobs/cancel-job");
    const { toast } = await import("sonner");
    const { useQueryState } = await import("nuqs");
    const setStatusParam = vi.fn();
    vi.mocked(useQueryState).mockImplementation(((key: string) => {
      if (key === "status") return ["running", setStatusParam];
      return ["all", vi.fn()];
    }) as any);

    const runningJob = {
      id: "job-err",
      type: "chat",
      entityId: "c-err",
      title: "Chat Err",
      status: "RUNNING",
      createdAt: new Date().toISOString(),
    };
    vi.mocked(listJobs).mockResolvedValue({
      ok: true,
      value: { jobs: [runningJob as any], offline: false },
    });

    render(<JobsView />);
    await vi.waitFor(() => {
      expect(screen.getByText("Chat Err")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /completed/i }));
    expect(setStatusParam).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getAllByRole("button", { name: /cancel/i })[0]);
    vi.mocked(cancelJob).mockRejectedValueOnce(new Error("Cancel boom"));
    fireEvent.click(screen.getByRole("button", { name: /cancel job/i }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Cancel boom");
    });
  });

  it("silently ignores initial loadJobs rejection when not a manual refresh", async () => {
    const { listJobs } = await import("@/actions/jobs/list-jobs");
    const { toast } = await import("sonner");
    vi.mocked(toast.error).mockClear();
    vi.mocked(listJobs).mockRejectedValueOnce(new Error("initial fail"));

    render(<JobsView />);
    await vi.waitFor(() => {
      expect(listJobs).toHaveBeenCalled();
    });
    expect(toast.error).not.toHaveBeenCalled();
  });
});

