import { fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JobsPage, { metadata } from "@/app/(main)/jobs/page";
import { JobsView } from "@/components/jobs/jobs-view";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { JobItem } from "@/types/jobs";

const render = (ui: React.ReactElement) =>
  rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

// Mock nuqs with reactive state
let mockQueryParams: Record<string, string> = { tab: "running" };
vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: (defaultVal: string) => ({
      withOptions: () => ({
        defaultValue: defaultVal,
      }),
    }),
    withOptions: () => ({}),
  },
  useQueryState: (key: string, options?: { defaultValue?: string }) => {
    const [val, setVal] = useState<string | null>(
      () => mockQueryParams[key] ?? options?.defaultValue ?? null,
    );
    const updateVal = (newVal: any) => {
      const resolved = typeof newVal === "function" ? newVal(val) : newVal;
      if (resolved === null || resolved === undefined || resolved === "") {
        delete mockQueryParams[key];
      } else {
        mockQueryParams[key] = resolved;
      }
      setVal(resolved);
    };
    return [val, updateVal];
  },
}));

// Mock sonner notifications
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock Server Actions
const mockListJobs = vi.hoisted(() => vi.fn());
vi.mock("@/actions/jobs/list-jobs", () => ({
  listJobs: mockListJobs,
}));

const mockCancelJob = vi.hoisted(() => vi.fn());
vi.mock("@/actions/jobs/cancel-job", () => ({
  cancelJob: mockCancelJob,
}));

const mockApproveWorkflowRunAction = vi.hoisted(() => vi.fn());
vi.mock("@/actions/workflow-runs/approve-workflow-run", () => ({
  approveWorkflowRunAction: mockApproveWorkflowRunAction,
}));

const mockRespondToToolApproval = vi.hoisted(() => vi.fn());
vi.mock("@/actions/chats/respond-to-tool-approval", () => ({
  respondToToolApproval: mockRespondToToolApproval,
}));

const sampleJobs: JobItem[] = [
  {
    id: "run-1",
    functionId: "chat-stream",
    functionName: "Chat Stream Runner",
    eventName: "chat/response.request",
    type: "chat",
    title: "Project Alpha Chat",
    subtitle: "AI chat stream",
    status: "RUNNING",
    queuedAt: "2026-09-28T10:00:00.000Z",
    startedAt: "2026-09-28T10:00:02.000Z",
    endedAt: null,
    durationMs: 45000,
    url: "/chats/chat-1",
    entityId: "chat-1",
    entityDeleted: false,
  },
  {
    id: "run-2",
    functionId: "workflow-run",
    functionName: "Workflow Runner",
    eventName: "workflows/execute.run",
    type: "workflow",
    title: "PDF Extract Agent",
    subtitle: "Step 2 of 4",
    status: "QUEUED",
    queuedAt: "2026-09-28T10:05:00.000Z",
    startedAt: null,
    endedAt: null,
    durationMs: undefined,
    url: "/workflows/wf-1/run-2",
    entityId: "run-2",
    entityDeleted: false,
  },
  {
    id: "run-3",
    functionId: "workflow-translation",
    functionName: "Batch Translator",
    eventName: "workflows/translation.start",
    type: "translation",
    title: "Spanish Localization",
    subtitle: "English → Spanish",
    status: "COMPLETED",
    queuedAt: "2026-09-28T09:30:00.000Z",
    startedAt: "2026-09-28T09:30:05.000Z",
    endedAt: "2026-09-28T09:31:35.000Z",
    durationMs: 90000,
    url: "/translation",
    entityId: "trans-1",
    entityDeleted: false,
  },
  {
    id: "run-4",
    functionId: "kb-ingest",
    functionName: "Document Ingestion",
    eventName: "kb/document.ingest",
    type: "kb-ingest",
    title: "Annual Financial Report",
    subtitle: "Vector embedding",
    status: "FAILED",
    queuedAt: "2026-09-28T09:00:00.000Z",
    startedAt: "2026-09-28T09:00:01.000Z",
    endedAt: "2026-09-28T09:00:15.000Z",
    durationMs: 14000,
    errorMessage: "Connection timeout to vector store",
    url: "/knowledgebases/kb-1",
    entityId: "doc-1",
    entityDeleted: false,
  },
  {
    id: "run-5",
    functionId: "kb-reindex",
    functionName: "KB Reindex",
    eventName: "kb/reindex.all",
    type: "kb-reindex",
    title: "Knowledge Base (Deleted or Unavailable)",
    status: "COMPLETED",
    queuedAt: "2026-09-28T08:00:00.000Z",
    startedAt: "2026-09-28T08:00:01.000Z",
    endedAt: "2026-09-28T08:02:01.000Z",
    durationMs: 120000,
    url: undefined,
    entityId: "kb-999",
    entityDeleted: true,
  },
];

describe("Running Jobs Page & JobsView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryParams = { tab: "running" };
    mockListJobs.mockResolvedValue({
      ok: true,
      value: {
        jobs: sampleJobs,
        offline: false,
      },
    });
    mockCancelJob.mockResolvedValue({
      ok: true,
      value: {
        success: true,
      },
    });
    mockApproveWorkflowRunAction.mockResolvedValue({
      ok: true,
      value: { success: true },
    });
    mockRespondToToolApproval.mockResolvedValue({
      ok: true,
      value: { success: true },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports metadata correctly for Server Component", () => {
    expect(metadata.title).toBe("Running Jobs | AI Client");
    expect(metadata.description).toBe(
      "Monitor and manage background jobs tracked by Inngest.",
    );
  });

  it("renders JobsPage wrapper containing JobsView", async () => {
    render(<JobsPage />);

    expect(
      screen.getByRole("heading", { name: "Running Jobs" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(1);
    });
  });

  it("renders initial jobs list on mount (running in RUNNING tab)", async () => {
    render(<JobsView />);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(1);
    });

    // RUNNING tab shows active running job
    expect(screen.getByText("Project Alpha Chat")).toBeInTheDocument();
    expect(screen.queryByText("PDF Extract Agent")).not.toBeInTheDocument();

    // Completed/Failed jobs are not in RUNNING tab
    expect(screen.queryByText("Spanish Localization")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Annual Financial Report"),
    ).not.toBeInTheDocument();
  });

  it("displays stat cards with accurate counts", async () => {
    render(<JobsView />);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalled();
    });

    // Running = 1
    // Queued = 1
    // Completed = 2
    // Failed = 1
    const statCards = screen.getAllByText(/^[0-9]+$/);
    const statValues = statCards.map((el) => el.textContent);

    expect(statValues).toContain("1"); // running
    expect(statValues).toContain("2"); // completed
  });

  it("switches tabs ('Running', 'Queued', 'Completed', 'Failed') and filters list correctly", async () => {
    const user = userEvent.setup();
    render(<JobsView />);

    await waitFor(() => {
      expect(screen.getByText("Project Alpha Chat")).toBeInTheDocument();
    });

    // Switch to "Queued" tab
    const queuedTab = screen.getByRole("tab", { name: /queued/i });
    await user.click(queuedTab);

    expect(screen.getByText("PDF Extract Agent")).toBeInTheDocument();
    expect(screen.queryByText("Project Alpha Chat")).not.toBeInTheDocument();
    expect(screen.queryByText("Spanish Localization")).not.toBeInTheDocument();

    // Switch to "Completed" tab
    const completedTab = screen.getByRole("tab", { name: /completed/i });
    await user.click(completedTab);

    expect(screen.getByText("Spanish Localization")).toBeInTheDocument();
    expect(
      screen.getByText("Knowledge Base (Deleted or Unavailable)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Project Alpha Chat")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Annual Financial Report"),
    ).not.toBeInTheDocument();

    // Switch to "Failed" tab
    const failedTab = screen.getByRole("tab", { name: /failed/i });
    await user.click(failedTab);

    expect(screen.getByText("Annual Financial Report")).toBeInTheDocument();
    expect(
      screen.getByText("Connection timeout to vector store"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Project Alpha Chat")).not.toBeInTheDocument();
    expect(screen.queryByText("Spanish Localization")).not.toBeInTheDocument();

    // Switch to "Show all"
    const showAllBtn = screen.getByRole("button", { name: /show all/i });
    await user.click(showAllBtn);

    expect(screen.getByText("Project Alpha Chat")).toBeInTheDocument();
    expect(screen.getByText("PDF Extract Agent")).toBeInTheDocument();
    expect(screen.getByText("Spanish Localization")).toBeInTheDocument();
    expect(screen.getByText("Annual Financial Report")).toBeInTheDocument();
    expect(
      screen.getByText("Knowledge Base (Deleted or Unavailable)"),
    ).toBeInTheDocument();

    // Switch back to "Running" tab
    const runningTab = screen.getByRole("tab", { name: /running/i });
    await user.click(runningTab);

    expect(screen.getByText("Project Alpha Chat")).toBeInTheDocument();
    expect(screen.queryByText("PDF Extract Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("Spanish Localization")).not.toBeInTheDocument();
  });

  it("search input filters jobs by title and type", async () => {
    const user = userEvent.setup();
    render(<JobsView />);

    await waitFor(() => {
      expect(screen.getByText("Project Alpha Chat")).toBeInTheDocument();
    });

    // Switch to ALL via show all button first
    const showAllBtn = screen.getByRole("button", { name: /show all/i });
    await user.click(showAllBtn);

    const searchInput = screen.getByPlaceholderText(
      /search jobs by title, type, or function/i,
    );

    // Search by title
    await user.type(searchInput, "Spanish");
    expect(screen.getByText("Spanish Localization")).toBeInTheDocument();
    expect(screen.queryByText("Project Alpha Chat")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Annual Financial Report"),
    ).not.toBeInTheDocument();

    // Search by type
    await user.clear(searchInput);
    await user.type(searchInput, "kb-ingest");
    expect(screen.getByText("Annual Financial Report")).toBeInTheDocument();
    expect(screen.queryByText("Spanish Localization")).not.toBeInTheDocument();

    // Clear search
    await user.clear(searchInput);
    expect(screen.getByText("Project Alpha Chat")).toBeInTheDocument();
    expect(screen.getByText("Spanish Localization")).toBeInTheDocument();
  });

  it("manual refresh button triggers listJobs", async () => {
    render(<JobsView />);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(1);
    });

    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(2);
    });
  });

  it("auto-refresh switch toggles polling state and handles tab visibility change", async () => {
    render(<JobsView />);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(1);
    });

    const toggle = screen.getByRole("switch", { name: /auto-refresh/i });
    expect(toggle).toBeChecked();

    // Toggle off
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();

    // Toggle on again
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();

    // Simulate tab becoming visible
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    fireEvent(document, new Event("visibilitychange"));

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(2);
    });
  });

  it("offline banner renders when offline: true and clicking Retry triggers reload", async () => {
    mockListJobs.mockResolvedValueOnce({
      ok: true,
      value: {
        jobs: [],
        offline: true,
        error: "Inngest server is not reachable",
      },
    });

    render(<JobsView />);

    await waitFor(() => {
      expect(screen.getByText("Inngest Engine Offline")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/cannot connect to inngest background engine/i),
    ).toBeInTheDocument();

    // Mock successful next call
    mockListJobs.mockResolvedValueOnce({
      ok: true,
      value: {
        jobs: sampleJobs,
        offline: false,
      },
    });

    const retryButton = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.queryByText("Inngest Engine Offline")).not.toBeInTheDocument();
      expect(screen.getByText("Project Alpha Chat")).toBeInTheDocument();
    });
  });

  it("cancelling a job opens confirmation dialog, calls cancelJob, shows toast, and updates list", async () => {
    render(<JobsView />);

    await waitFor(() => {
      expect(screen.getByText("Project Alpha Chat")).toBeInTheDocument();
    });

    // Find the cancel button for the running job
    const cancelButtons = screen.getAllByRole("button", { name: /cancel/i });
    expect(cancelButtons.length).toBeGreaterThan(0);

    // Click cancel button on first running job
    fireEvent.click(cancelButtons[0]);

    // Confirmation dialog should open
    expect(screen.getByText("Cancel Job Run")).toBeInTheDocument();
    expect(
      screen.getByText(/are you sure you want to cancel the job/i),
    ).toBeInTheDocument();

    // Click confirm in alert dialog
    const confirmButton = screen.getByRole("button", { name: /^cancel job$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockCancelJob).toHaveBeenCalledWith("run-1", {
        chatId: "chat-1",
        workflowRunId: undefined,
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Job run cancelled successfully",
      );
    });
  });

  it("handles cancelled workflow job with workflowRunId", async () => {
    const user = userEvent.setup();
    render(<JobsView />);

    await waitFor(() => {
      expect(screen.getByText("Project Alpha Chat")).toBeInTheDocument();
    });

    // Switch to Queued tab where workflow job is located
    await user.click(screen.getByRole("tab", { name: /queued/i }));
    expect(screen.getByText("PDF Extract Agent")).toBeInTheDocument();

    // Cancel workflow job
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(screen.getByText("Cancel Job Run")).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /^cancel job$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockCancelJob).toHaveBeenCalledWith("run-2", {
        chatId: undefined,
        workflowRunId: "run-2",
      });
    });
  });

  it("deleted entity handles gracefully (displays deleted badge, disables Open button)", async () => {
    const user = userEvent.setup();
    render(<JobsView />);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalled();
    });

    // Switch to All via Show all button where deleted entity is present
    await user.click(screen.getByRole("button", { name: /show all/i }));

    expect(
      screen.getByText("Knowledge Base (Deleted or Unavailable)"),
    ).toBeInTheDocument();

    // Displays Deleted badge
    expect(screen.getByText("Deleted")).toBeInTheDocument();

    // Check Open buttons
    const openButtons = screen.getAllByRole("button", { name: /open/i });
    // Deleted item's open button should be disabled
    const disabledOpenButtons = openButtons.filter((btn) =>
      btn.hasAttribute("disabled"),
    );
    expect(disabledOpenButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty states for 'Running' and filtered search results", async () => {
    const user = userEvent.setup();
    mockListJobs.mockResolvedValueOnce({
      ok: true,
      value: {
        jobs: [],
        offline: false,
      },
    });

    render(<JobsView />);

    await waitFor(() => {
      expect(screen.getByText("No running jobs")).toBeInTheDocument();
      expect(
        screen.getByText("There are currently no background jobs running."),
      ).toBeInTheDocument();
    });

    // Switch tab to queued
    await user.click(screen.getByRole("tab", { name: /queued/i }));
    expect(screen.getByText("No queued jobs")).toBeInTheDocument();

    // Switch tab to completed
    await user.click(screen.getByRole("tab", { name: /completed/i }));
    expect(screen.getByText("No completed jobs")).toBeInTheDocument();

    // Switch tab to failed
    await user.click(screen.getByRole("tab", { name: /failed/i }));
    expect(screen.getByText("No failed jobs")).toBeInTheDocument();

    // Search query matching nothing
    const searchInput = screen.getByPlaceholderText(
      /search jobs by title, type, or function/i,
    );
    await user.type(searchInput, "nonexistent");

    expect(screen.getByText("No matching jobs found")).toBeInTheDocument();
    expect(
      screen.getByText(/no jobs matched "nonexistent"/i),
    ).toBeInTheDocument();
  });

  it("suppresses error toast on background mount/polling but shows on manual refresh", async () => {
    mockListJobs.mockResolvedValueOnce({
      ok: true,
      value: {
        jobs: [],
        offline: false,
        error: "Failed to connect to background worker",
      },
    });

    render(<JobsView />);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(1);
    });

    // On mount / background polling, no toast should be emitted
    expect(toast.error).not.toHaveBeenCalled();

    // Now trigger manual refresh with same error condition
    mockListJobs.mockResolvedValueOnce({
      ok: true,
      value: {
        jobs: [],
        offline: false,
        error: "Failed to connect to background worker",
      },
    });

    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(2);
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to connect to background worker",
      );
    });
  });

  it("suppresses toast on background polling action failure and network throws, shows on manual refresh", async () => {
    // 1. Action failure on mount (background)
    mockListJobs.mockResolvedValueOnce({
      ok: false,
      error: { message: "Server action failed" },
    });

    const { unmount } = render(<JobsView />);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(1);
    });

    expect(toast.error).not.toHaveBeenCalled();
    unmount();

    // 2. Exception throw on manual refresh
    mockListJobs.mockResolvedValueOnce({
      ok: true,
      value: { jobs: [], offline: false },
    });

    render(<JobsView />);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(2);
    });

    mockListJobs.mockRejectedValueOnce(new Error("Network connection lost"));
    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockListJobs).toHaveBeenCalledTimes(3);
      expect(toast.error).toHaveBeenCalledWith("Network connection lost");
    });
  });

  it("renders workflow human review approval panel and submits approval with feedback", async () => {
    const user = userEvent.setup();
    mockListJobs.mockResolvedValueOnce({
      ok: true,
      value: {
        jobs: [
          {
            id: "run-review-1",
            functionId: "workflow-run",
            functionName: "Workflow Runner",
            eventName: "workflows/execute.run",
            type: "workflow",
            title: "Invoice Approval Flow",
            status: "RUNNING",
            queuedAt: "2026-09-28T10:00:00.000Z",
            startedAt: "2026-09-28T10:00:01.000Z",
            endedAt: null,
            url: "/workflows/wf-1/run-wf-1",
            entityId: "run-wf-1",
            approval: {
              kind: "workflow-review",
              runId: "run-wf-1",
              nodeId: "node-1",
              nodeName: "Verify Totals",
              gateId: "gate-1",
              reviewPhase: "before",
            },
          },
        ],
        offline: false,
      },
    });

    render(<JobsView />);

    await waitFor(() => {
      expect(screen.getByText("Awaiting Review")).toBeInTheDocument();
      expect(
        screen.getByText(/human review required — verify totals/i),
      ).toBeInTheDocument();
    });

    const feedbackInput = screen.getByLabelText("Review feedback");
    await user.type(feedbackInput, "Looks good");
    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => {
      expect(mockApproveWorkflowRunAction).toHaveBeenCalledWith({
        runId: "run-wf-1",
        nodeId: "node-1",
        gateId: "gate-1",
        approved: true,
        feedback: "Looks good",
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Approval submitted — resuming workflow",
      );
    });
  });

  it("renders workflow tool approval panel and submits tool decisions", async () => {
    const user = userEvent.setup();
    mockListJobs.mockResolvedValueOnce({
      ok: true,
      value: {
        jobs: [
          {
            id: "run-wf-tool-1",
            functionId: "workflow-run",
            functionName: "Workflow Runner",
            eventName: "workflows/execute.run",
            type: "workflow",
            title: "Deploy Automation",
            status: "RUNNING",
            queuedAt: "2026-09-28T10:00:00.000Z",
            startedAt: "2026-09-28T10:00:01.000Z",
            endedAt: null,
            url: "/workflows/wf-2/run-wf-2",
            entityId: "run-wf-2",
            approval: {
              kind: "workflow-tool",
              runId: "run-wf-2",
              nodeId: "node-2",
              nodeName: "Publish Step",
              gateId: "gate-2",
              pendingApprovals: [
                {
                  approvalId: "app-1",
                  toolCallId: "tc-1",
                  toolName: "send_email",
                  serverName: "Gmail",
                  args: { to: "team@example.com" },
                  signature: "sig-1",
                },
              ],
            },
          },
        ],
        offline: false,
      },
    });

    render(<JobsView />);

    await waitFor(() => {
      expect(screen.getByText("Approval Required")).toBeInTheDocument();
      expect(screen.getByText("send_email")).toBeInTheDocument();
      expect(screen.getByText("Gmail")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => {
      expect(mockApproveWorkflowRunAction).toHaveBeenCalledWith({
        runId: "run-wf-2",
        nodeId: "node-2",
        gateId: "gate-2",
        approved: true,
        toolDecisions: [{ approvalId: "app-1", approved: true }],
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Tool approval submitted — resuming run",
      );
    });
  });

  it("renders chat tool approval panel and calls respondToToolApproval on deny", async () => {
    const user = userEvent.setup();
    mockListJobs.mockResolvedValueOnce({
      ok: true,
      value: {
        jobs: [
          {
            id: "run-chat-tool-1",
            functionId: "chat-stream",
            functionName: "Chat Stream Runner",
            eventName: "chat/response.generate",
            type: "chat",
            title: "Research Chat",
            status: "RUNNING",
            queuedAt: "2026-09-28T10:00:00.000Z",
            startedAt: "2026-09-28T10:00:01.000Z",
            endedAt: null,
            url: "/chats/chat-99",
            entityId: "chat-99",
            approval: {
              kind: "chat-tool",
              assistantMessageId: "msg-99",
              pendingApprovals: [
                {
                  approvalId: "app-chat-1",
                  toolCallId: "tc-chat-1",
                  toolName: "delete_file",
                  args: { path: "/tmp/a.txt" },
                  signature: "sig-c1",
                },
              ],
            },
          },
        ],
        offline: false,
      },
    });

    render(<JobsView />);

    await waitFor(() => {
      expect(screen.getByText("delete_file")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^deny$/i }));

    await waitFor(() => {
      expect(mockRespondToToolApproval).toHaveBeenCalledWith({
        assistantMessageId: "msg-99",
        decisions: [{ approvalId: "app-chat-1", approved: false }],
      });
      expect(toast.success).toHaveBeenCalledWith("Tool execution denied");
    });
  });

  it("tracks pending approval submissions independently per job on success and failure", async () => {
    const user = userEvent.setup();
    let resolveJobA!: (value: { ok: true; value: { status: string } }) => void;
    let rejectJobB!: (reason?: unknown) => void;

    mockApproveWorkflowRunAction
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveJobA = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectJobB = reject;
          }),
      );

    mockListJobs.mockResolvedValue({
      ok: true,
      value: {
        jobs: [
          {
            id: "job-a",
            functionId: "workflow-run",
            functionName: "Workflow Runner",
            eventName: "workflows/execute.run",
            type: "workflow",
            title: "Job A",
            status: "RUNNING",
            queuedAt: "2026-09-28T10:00:00.000Z",
            startedAt: "2026-09-28T10:00:01.000Z",
            endedAt: null,
            url: "/workflows/wf-a/run-a",
            entityId: "run-a",
            approval: {
              kind: "workflow-review",
              runId: "run-a",
              nodeId: "node-a",
              nodeName: "Step A",
              gateId: "gate-a",
              reviewPhase: "before",
            },
          },
          {
            id: "job-b",
            functionId: "workflow-run",
            functionName: "Workflow Runner",
            eventName: "workflows/execute.run",
            type: "workflow",
            title: "Job B",
            status: "RUNNING",
            queuedAt: "2026-09-28T10:00:00.000Z",
            startedAt: "2026-09-28T10:00:01.000Z",
            endedAt: null,
            url: "/workflows/wf-b/run-b",
            entityId: "run-b",
            approval: {
              kind: "workflow-review",
              runId: "run-b",
              nodeId: "node-b",
              nodeName: "Step B",
              gateId: "gate-b",
              reviewPhase: "before",
            },
          },
        ],
        offline: false,
      },
    });

    render(<JobsView />);

    await waitFor(() => {
      expect(screen.getByText("Job A")).toBeInTheDocument();
      expect(screen.getByText("Job B")).toBeInTheDocument();
    });

    const approveButtons = screen.getAllByRole("button", { name: /^approve$/i });
    expect(approveButtons).toHaveLength(2);

    // Start approval on Job A
    await user.click(approveButtons[0]);
    expect(approveButtons[0]).toBeDisabled();
    expect(approveButtons[1]).toBeEnabled();

    // Start approval on Job B while Job A is still pending — both must stay disabled
    await user.click(approveButtons[1]);
    expect(approveButtons[0]).toBeDisabled();
    expect(approveButtons[1]).toBeDisabled();

    // Resolve Job A — Job A re-enables, Job B must remain disabled
    resolveJobA({ ok: true, value: { status: "resumed" } });
    await waitFor(() => {
      expect(approveButtons[0]).toBeEnabled();
    });
    expect(approveButtons[1]).toBeDisabled();

    // Reject Job B — Job B cleans up and re-enables on failure
    rejectJobB(new Error("Network error"));
    await waitFor(() => {
      expect(approveButtons[1]).toBeEnabled();
    });
    expect(toast.error).toHaveBeenCalledWith("Network error");
  });
});
