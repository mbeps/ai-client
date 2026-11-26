import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobApprovalPanel } from "@/components/jobs/job-approval-panel";
import type { JobApprovalInfo } from "@/types/jobs";

describe("JobApprovalPanel", () => {
  it("renders workflow-review without nodeName/reviewPhase and handles Reject with/without feedback", () => {
    const onApproveWorkflowReview = vi.fn();
    const approval: JobApprovalInfo = {
      kind: "workflow-review",
      runId: "run-1",
      nodeId: "node-1",
    };

    render(
      <JobApprovalPanel
        approval={approval}
        isSubmitting={false}
        onApproveWorkflowReview={onApproveWorkflowReview}
        onSubmitToolDecisions={vi.fn()}
      />,
    );

    expect(screen.getByText("Human Review Required")).toBeInTheDocument();

    // Reject without feedback
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(onApproveWorkflowReview).toHaveBeenCalledWith(
      approval,
      false,
      undefined,
    );

    // Reject with feedback
    fireEvent.change(screen.getByLabelText("Review feedback"), {
      target: { value: "Needs changes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(onApproveWorkflowReview).toHaveBeenCalledWith(
      approval,
      false,
      "Needs changes",
    );
  });

  it("renders multiple pending tool approvals, handles Allow/Deny/Approve All/Submit/Reject, and circular/undefined args", () => {
    const onSubmitToolDecisions = vi.fn();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const approval: JobApprovalInfo = {
      kind: "workflow-tool",
      runId: "run-2",
      nodeId: "node-2",
      nodeName: "Research",
      pendingApprovals: [
        {
          approvalId: "a1",
          toolCallId: "tc1",
          toolName: "web_search",
          args: undefined,
          subagentName: "researcher",
        },
        {
          approvalId: "a2",
          toolCallId: "tc2",
          toolName: "read_file",
          args: circular,
        },
      ],
    };

    const { rerender } = render(
      <JobApprovalPanel
        approval={approval}
        isSubmitting={false}
        onApproveWorkflowReview={vi.fn()}
        onSubmitToolDecisions={onSubmitToolDecisions}
      />,
    );

    expect(screen.getByText("researcher")).toBeInTheDocument();
    expect(screen.getByText("{}")).toBeInTheDocument();
    expect(screen.getByText("[object Object]")).toBeInTheDocument();

    // Deny second item and Submit (first item left untouched -> defaults to true via ?? true)
    const denyButtons = screen.getAllByRole("button", { name: /^deny$/i });
    fireEvent.click(denyButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmitToolDecisions).toHaveBeenCalledWith(approval, true, [
      { approvalId: "a1", approved: true },
      { approvalId: "a2", approved: false },
    ]);

    // Toggle Deny then Allow on first item
    fireEvent.click(denyButtons[0]);
    const allowButtons = screen.getAllByRole("button", { name: /^allow$/i });
    fireEvent.click(allowButtons[0]);

    // Approve All
    fireEvent.click(screen.getByRole("button", { name: /approve all/i }));
    expect(onSubmitToolDecisions).toHaveBeenCalledWith(approval, true, [
      { approvalId: "a1", approved: true },
      { approvalId: "a2", approved: true },
    ]);

    // Reject
    fireEvent.click(screen.getByRole("button", { name: /^reject$/i }));
    expect(onSubmitToolDecisions).toHaveBeenCalledWith(approval, false, [
      { approvalId: "a1", approved: false },
      { approvalId: "a2", approved: false },
    ]);

    // Submitting state shows spinner
    rerender(
      <JobApprovalPanel
        approval={approval}
        isSubmitting={true}
        onApproveWorkflowReview={vi.fn()}
        onSubmitToolDecisions={onSubmitToolDecisions}
      />,
    );
    expect(screen.getByRole("button", { name: /approve all/i })).toBeDisabled();
  });
});
