import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResizablePanelGroup } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkflowRunApprovalBanner } from "@/components/workflows/run/workflow-run-approval-banner";
import { WorkflowRunHeader } from "@/components/workflows/run/workflow-run-header";
import { WorkflowRunNodeCard } from "@/components/workflows/run/workflow-run-node-card";
import { WorkflowRunPreviewPane } from "@/components/workflows/run/workflow-run-preview-pane";
import { WorkflowRunTimeline } from "@/components/workflows/run/workflow-run-timeline";
import type { WorkflowNode, WorkflowNodeRunState } from "@/types/workflows/workflow";

vi.mock("@/components/chat/artifact-panel", () => ({
  ArtifactPanel: ({ artifact }: { artifact: { title: string } }) => (
    <div data-testid="mock-artifact-panel">{artifact.title}</div>
  ),
}));

const sampleNodes: WorkflowNode[] = [
  {
    id: "n1",
    type: "if_condition",
    name: "Check Total",
    position: { x: 0, y: 0 },
    data: {
      kind: "if_condition",
      variableName: "branch1",
      evaluationMode: "deterministic",
      logic: "and",
      rules: [],
    },
  },
  {
    id: "n2",
    type: "ai_step",
    name: "Generate Summary",
    position: { x: 300, y: 0 },
    data: {
      kind: "ai_step",
      variableName: "step1",
      prompt: "Summarize",
      mcpServerIds: [],
      toolIds: [],
      requiresReview: true,
    },
  },
];

describe("Workflow Run Workbench Components", () => {
  it("renders WorkflowRunApprovalBanner for review pause and submits approve/reject", () => {
    const onSubmitReview = vi.fn();
    render(
      <WorkflowRunApprovalBanner
        status="awaiting_review"
        currentNode={sampleNodes[1]}
        nodeState={{ status: "awaiting_review", reviewPhase: "after" }}
        onSubmitReview={onSubmitReview}
        onSubmitToolDecisions={vi.fn()}
        isSubmitting={false}
      />,
    );

    expect(screen.getByText(/Generate Summary/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Approve & Continue/i }));
    expect(onSubmitReview).toHaveBeenCalledWith(true, "");

    fireEvent.click(screen.getByRole("button", { name: /Reject & Stop/i }));
    expect(onSubmitReview).toHaveBeenCalledWith(false, "");
  });

  it("renders WorkflowRunApprovalBanner for tool execution approvals", () => {
    const onSubmitToolDecisions = vi.fn();
    render(
      <WorkflowRunApprovalBanner
        status="awaiting_tool_approval"
        currentNode={sampleNodes[1]}
        nodeState={{
          status: "awaiting_tool_approval",
          pendingToolApprovals: [
            {
              approvalId: "tc-1",
              toolCallId: "tc-1",
              toolName: "delete_row",
              serverId: "srv-1",
              serverName: "sheets",
              args: { row: 2 },
              signature: "delete_row:{}",
            },
          ],
        }}
        onSubmitReview={vi.fn()}
        onSubmitToolDecisions={onSubmitToolDecisions}
        isSubmitting={false}
      />,
    );

    expect(screen.getByText("delete_row")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Approve All & Resume/i }),
    );
    expect(onSubmitToolDecisions).toHaveBeenCalledWith(true, { "tc-1": true });
  });

  it("renders WorkflowRunNodeCard, WorkflowRunTimeline, Header, and PreviewPane", () => {
    const onSelectNode = vi.fn();
    const onViewModeChange = vi.fn();
    const nodeStates: Record<string, WorkflowNodeRunState> = {
      n1: {
        status: "completed",
        branchTaken: "true",
        conditionReasoning: "Total > 100",
      },
      n2: {
        status: "completed",
        summary: "Summary complete",
      },
    };

    render(
      <TooltipProvider>
        <div>
          <WorkflowRunHeader
            workflowId="wf-1"
            workflowName="Invoice Flow"
            status="completed"
            progress={100}
            dryRun={true}
            viewMode="graph"
            onViewModeChange={onViewModeChange}
          />
          <WorkflowRunNodeCard
            node={sampleNodes[0]}
            state={nodeStates.n1}
            isSelected={false}
            onClick={() => onSelectNode("n1")}
          />
          <WorkflowRunTimeline
            nodes={sampleNodes}
            nodeStates={nodeStates}
            selectedNodeId="n1"
            onSelectNode={onSelectNode}
          />
          <ResizablePanelGroup orientation="horizontal">
            <WorkflowRunPreviewPane
              isLoadingArtifact={false}
              currentArtifact={{
                id: "art-1",
                type: "markdown",
                title: "Invoice Report",
                content: "# Report",
              }}
              isArtifactOpen={true}
              onCloseArtifact={vi.fn()}
              selectedNodeId="n2"
            />
          </ResizablePanelGroup>
        </div>
      </TooltipProvider>,
    );

    expect(screen.getByText("Invoice Flow")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Timeline View/i }));
    expect(onViewModeChange).toHaveBeenCalledWith("timeline");
    expect(screen.getAllByText(/true/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("mock-artifact-panel")).toHaveTextContent(
      "Invoice Report",
    );
  });
});
