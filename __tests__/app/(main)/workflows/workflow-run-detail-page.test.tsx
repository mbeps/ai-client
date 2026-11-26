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
  WorkflowCanvas: ({
    selectedNodeId,
    onSelectNode,
  }: {
    selectedNodeId?: string | null;
    onSelectNode?: (id: string) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-readonly-canvas"
      data-selected={selectedNodeId ?? ""}
      onClick={() => onSelectNode?.("n1")}
    >
      Live Graph
    </button>
  ),
}));

vi.mock("@/components/chat/artifact-panel", () => ({
  ArtifactPanel: ({
    artifact,
    onClose,
  }: {
    artifact: { title: string };
    onClose?: () => void;
  }) => (
    <div data-testid="mock-run-artifact">
      {artifact.title}
      <button type="button" data-testid="mock-close-artifact" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

const mockSetSelectedNodeId = vi.fn();
const mockRetryLoad = vi.fn();
const mockRetryStart = vi.fn();

const mockUseWorkflowRunData = vi.hoisted(() => vi.fn());
const mockUseWorkflowRunStream = vi.hoisted(() => vi.fn());

vi.mock("@/components/workflows/run/use-workflow-run-data", () => ({
  useWorkflowRunData: mockUseWorkflowRunData,
}));

vi.mock("@/components/workflows/run/use-workflow-run-stream", () => ({
  useWorkflowRunStream: mockUseWorkflowRunStream,
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
  function baseRunData(overrides: Record<string, unknown> = {}) {
    return {
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
      setSelectedNodeId: mockSetSelectedNodeId,
      isArtifactOpen: true,
      setIsArtifactOpen: vi.fn(),
      isLoading: false,
      loadError: null,
      retryLoad: mockRetryLoad,
      isApproving: false,
      attachmentMeta: {},
      loadAttachmentUrls: vi.fn(),
      handleSubmitReview: vi.fn(),
      handleSubmitToolDecisions: vi.fn(),
      ...overrides,
    };
  }

  it("renders approval banner, live graph view, timeline toggle, and preview pane", () => {
    mockUseWorkflowRunData.mockReturnValue(baseRunData());
    mockUseWorkflowRunStream.mockReturnValue({
      streamError: null,
      retryStart: mockRetryStart,
    });

    render(
      <TooltipProvider>
        <WorkflowRunDetailPage />
      </TooltipProvider>,
    );

    expect(screen.getByText("Live DAG Workflow")).toBeInTheDocument();
    const canvas = screen.getByTestId("mock-readonly-canvas");
    expect(canvas).toHaveAttribute("data-selected", "n1");
    fireEvent.click(canvas);
    expect(mockSetSelectedNodeId).toHaveBeenCalledWith("n1");
    expect(screen.getAllByTestId("mock-run-artifact")[0]).toHaveTextContent(
      "Generated Spec",
    );
    expect(
      screen.getByRole("button", { name: /Approve & Continue/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Timeline View/i }));
    expect(screen.getByText("Review Step")).toBeInTheDocument();

    for (const btn of screen.getAllByTestId("mock-close-artifact")) {
      fireEvent.click(btn);
    }
  });

  it("renders load error retry button and stream retry button when pending start fails", () => {
    mockRetryLoad.mockClear();
    mockUseWorkflowRunData.mockReturnValue(
      baseRunData({ run: null, workflow: null, loadError: "Network timeout" }),
    );
    mockUseWorkflowRunStream.mockReturnValue({
      streamError: null,
      retryStart: mockRetryStart,
    });

    const { rerender } = render(
      <TooltipProvider>
        <WorkflowRunDetailPage />
      </TooltipProvider>,
    );

    expect(screen.getByText("Failed to load workflow run")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mockRetryLoad).toHaveBeenCalledTimes(1);

    mockRetryStart.mockClear();
    const pendingData = baseRunData();
    pendingData.run = { ...pendingData.run, status: "pending" };
    mockUseWorkflowRunData.mockReturnValue(pendingData);
    mockUseWorkflowRunStream.mockReturnValue({
      streamError: "Failed to dispatch workflow execution",
      retryStart: mockRetryStart,
    });

    rerender(
      <TooltipProvider>
        <WorkflowRunDetailPage />
      </TooltipProvider>,
    );

    expect(
      screen.getByText("Failed to dispatch workflow execution"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mockRetryStart).toHaveBeenCalledTimes(1);
  });

  it("handles loading, notFound, and null currentNodeId", () => {
    mockUseWorkflowRunData.mockReturnValue(baseRunData({ isLoading: true }));
    mockUseWorkflowRunStream.mockReturnValue({
      streamError: null,
      retryStart: mockRetryStart,
    });

    const { rerender } = render(
      <TooltipProvider>
        <WorkflowRunDetailPage />
      </TooltipProvider>,
    );
    expect(screen.queryByText("Live DAG Workflow")).not.toBeInTheDocument();

    mockUseWorkflowRunData.mockReturnValue(
      baseRunData({ run: null, workflow: null, loadError: null }),
    );
    rerender(
      <TooltipProvider>
        <WorkflowRunDetailPage />
      </TooltipProvider>,
    );

    const noNodeData = baseRunData();
    noNodeData.run = { ...noNodeData.run, currentNodeId: null };
    mockUseWorkflowRunData.mockReturnValue(noNodeData);
    rerender(
      <TooltipProvider>
        <WorkflowRunDetailPage />
      </TooltipProvider>,
    );
    expect(screen.getByText("Live DAG Workflow")).toBeInTheDocument();

    mockUseWorkflowRunData.mockReturnValue(
      baseRunData({ workflow: null, loadError: "Missing workflow" }),
    );
    rerender(
      <TooltipProvider>
        <WorkflowRunDetailPage />
      </TooltipProvider>,
    );
    expect(screen.getByText("Failed to load workflow run")).toBeInTheDocument();
  });
});
