import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WorkflowRunDetailPage from "@/app/(main)/workflows/[id]/[runId]/page";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  DEFAULT_WORKFLOW_CANVAS_CONFIG,
} from "@/types/workflows/workflow";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "wf-1", runId: "run-1" }),
  notFound: vi.fn(),
}));

vi.mock("@/components/workflows/canvas/workflow-canvas", () => ({
  WorkflowCanvas: () => <div data-testid="mock-readonly-canvas">Live Graph</div>,
}));

vi.mock("@/components/chat/artifact-panel", () => ({
  ArtifactPanel: ({ artifact }: { artifact: { title: string } }) => (
    <div data-testid="mock-run-artifact">{artifact.title}</div>
  ),
}));

vi.mock("@/components/workflows/run/use-workflow-run-data", () => ({
  useWorkflowRunData: () => ({
    run: {
      id: "run-1",
      workflowId: "wf-1",
      userId: "u-1",
      triggerType: "manual",
      status: "awaiting_review",
      currentNodeId: "n1",
      dryRun: false,
      initialData: {},
      nodeStates: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    setRun: vi.fn(),
    workflow: {
      id: "wf-1",
      userId: "u-1",
      name: "Live DAG Workflow",
      description: "",
      tools: [],
      skillMode: "dynamic",
      skillIds: [],
      knowledgeBaseIds: [],
      subagentIds: [],
      requiresFileUpload: false,
      canvasConfig: DEFAULT_WORKFLOW_CANVAS_CONFIG,
      approvalConfig: DEFAULT_WORKFLOW_APPROVAL_CONFIG,
      nodes: [
        {
          id: "n1",
          type: "ai_step",
          name: "Review Step",
          position: { x: 0, y: 0 },
          data: {
            kind: "ai_step",
            variableName: "step1",
            prompt: "Run",
            mcpServerIds: [],
            toolIds: [],
            requiresReview: true,
          },
        },
      ],
      edges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    nodeStates: {
      n1: { status: "awaiting_review", reviewPhase: "after" },
    },
    setNodeStates: vi.fn(),
    selectedNodeId: "n1",
    setSelectedNodeId: vi.fn(),
    isArtifactOpen: true,
    setIsArtifactOpen: vi.fn(),
    isLoading: false,
    isApproving: false,
    attachmentMeta: {},
    loadAttachmentUrls: vi.fn(),
    handleSubmitReview: vi.fn(),
    handleSubmitToolDecisions: vi.fn(),
  }),
}));

vi.mock("@/components/workflows/run/use-workflow-run-stream", () => ({
  useWorkflowRunStream: () => ({ streamError: null }),
}));

vi.mock("@/components/workflows/run/use-workflow-run-artifacts", () => ({
  useWorkflowRunArtifacts: () => ({
    isLoadingArtifact: false,
    currentArtifact: {
      id: "art-1",
      type: "markdown",
      title: "Generated Spec",
      content: "# Spec",
    },
    hasAnyArtifact: true,
  }),
}));

describe("WorkflowRunDetailPage", () => {
  it("renders approval banner, live graph view, timeline toggle, and preview pane", () => {
    render(
      <TooltipProvider>
        <WorkflowRunDetailPage />
      </TooltipProvider>,
    );

    expect(screen.getByText("Live DAG Workflow")).toBeInTheDocument();
    expect(screen.getByTestId("mock-readonly-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("mock-run-artifact")).toHaveTextContent(
      "Generated Spec",
    );
    expect(
      screen.getByRole("button", { name: /Approve & Continue/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Timeline View/i }));
    expect(screen.getByText("Review Step")).toBeInTheDocument();
  });
});
