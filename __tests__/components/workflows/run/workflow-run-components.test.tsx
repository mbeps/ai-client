import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-resizable-panels", () => ({
  Group: ({ children }: any) => <div>{children}</div>,
  Panel: ({ children }: any) => <div>{children}</div>,
  Separator: () => <div data-testid="panel-separator" />,
}));
import { ResizablePanelGroup } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkflowRunApprovalBanner } from "@/components/workflows/run/workflow-run-approval-banner";
import { WorkflowRunFilesSection } from "@/components/workflows/run/workflow-run-files-section";
import { WorkflowRunHeader } from "@/components/workflows/run/workflow-run-header";
import { WorkflowRunNodeCard } from "@/components/workflows/run/workflow-run-node-card";
import { WorkflowRunPreviewPane } from "@/components/workflows/run/workflow-run-preview-pane";
import { WorkflowRunTimeline } from "@/components/workflows/run/workflow-run-timeline";
import type { WorkflowNode, WorkflowNodeRunState } from "@/types/workflows/workflow";

const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/utils/download-file", () => ({
  downloadFile: mockDownloadFile,
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

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

  it("renders WorkflowRunNodeCard with thinking tab, markdown body, tool traces, and canvas card", () => {
    const onCardClick = vi.fn();
    render(
      <TooltipProvider>
        <WorkflowRunNodeCard
          node={sampleNodes[1]}
          state={{
            status: "completed",
            summary:
              "<think>Checking car specs</think>\n\n**Added BMW 320d** to workbook.",
            toolCalls: [
              {
                toolCallId: "tc-1",
                toolName: "create_workbook",
                args: { name: "cars.xlsx" },
                result: { ok: true },
                status: "complete",
              },
            ],
            artifact: {
              id: "art-step-1",
              type: "spreadsheet",
              title: "Cars Workbook",
              content: "Brand,Model\nBMW,320d",
            },
            completedAt: "2026-11-23T18:00:00.000Z",
          }}
          isSelected={true}
          onClick={onCardClick}
        />
      </TooltipProvider>,
    );

    // Raw <think> tags should not appear in visible output; Thought process tab should
    expect(screen.queryByText(/<think>/)).not.toBeInTheDocument();
    const thoughtTrigger = screen.getByRole("button", {
      name: /Thought process/i,
    });
    expect(thoughtTrigger).toBeInTheDocument();

    // Toggling the thought process tab should reveal reasoning without triggering card onClick
    fireEvent.click(thoughtTrigger);
    expect(screen.getByText("Checking car specs")).toBeInTheDocument();
    expect(onCardClick).not.toHaveBeenCalled();

    // Markdown should render bold text cleanly
    const boldEl = screen.getByText("Added BMW 320d");
    expect(boldEl.tagName).toBe("STRONG");

    // Tool call should render via ToolTraceStep (not plain badge)
    expect(screen.getByText("create_workbook")).toBeInTheDocument();

    // Artifact should render via CanvasCard and clicking its toggle selects the node
    const toggleCanvasBtn = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(toggleCanvasBtn);
    expect(onCardClick).toHaveBeenCalledTimes(1);

    // Keyboard activation on card header calls onClick without interfering with nested controls
    const headerTrigger = screen.getByRole("button", {
      name: /Select Generate Summary/i,
    });
    fireEvent.keyDown(headerTrigger, { key: "Enter" });
    fireEvent.keyDown(headerTrigger, { key: " " });
    expect(onCardClick).toHaveBeenCalledTimes(3);
  });

  it("shows toast error when WorkflowRunFilesSection fails to download a file", async () => {
    mockDownloadFile.mockRejectedValueOnce(new Error("Network error"));
    render(
      <WorkflowRunFilesSection
        inputAttachmentIds={["att-1"]}
        attachmentMeta={{ "att-1": { url: "https://example.com/a.xlsx", name: "a.xlsx" } }}
      />,
    );

    fireEvent.click(screen.getByText("a.xlsx"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to download file");
    });
  });

  it("covers WorkflowRunFilesSection missing meta, WorkflowRunPreviewPane, WorkflowRunTimeline, WorkflowRunHeader, and WorkflowRunNodeCard", async () => {
    // Missing meta in WorkflowRunFilesSection
    render(
      <WorkflowRunFilesSection
        inputAttachmentIds={["missing-id", "att-1"]}
        attachmentMeta={{ "att-1": { url: "https://example.com/a.xlsx", name: "a.xlsx" } }}
      />,
    );
    expect(screen.getByText("a.xlsx")).toBeInTheDocument();

    // WorkflowRunPreviewPane states
    const { rerender } = render(
      <WorkflowRunPreviewPane
        isLoadingArtifact={true}
        currentArtifact={null}
        isArtifactOpen={false}
        onCloseArtifact={vi.fn()}
        selectedNodeId={null}
      />,
    );
    expect(screen.getByText("Loading artifact preview...")).toBeInTheDocument();

    rerender(
      <WorkflowRunPreviewPane
        isLoadingArtifact={false}
        currentArtifact={null}
        isArtifactOpen={false}
        onCloseArtifact={vi.fn()}
        selectedNodeId="n1"
      />,
    );
    expect(
      screen.getByText("This node has not produced a Canvas artifact."),
    ).toBeInTheDocument();

    rerender(
      <WorkflowRunPreviewPane
        isLoadingArtifact={false}
        currentArtifact={null}
        isArtifactOpen={false}
        onCloseArtifact={vi.fn()}
        selectedNodeId={null}
      />,
    );
    expect(
      screen.getByText(/Select a node from the live graph or timeline/i),
    ).toBeInTheDocument();

    // WorkflowRunHeader: Graph View + Download Final Result success & error
    const onViewModeChange = vi.fn();
    mockDownloadFile.mockResolvedValueOnce(undefined);
    render(
      <WorkflowRunHeader
        workflowId="wf-1"
        workflowName="My Flow"
        status="completed"
        viewMode="timeline"
        onViewModeChange={onViewModeChange}
        outputAttachmentIds={[]}
        attachmentMeta={{}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Graph View/i }));
    expect(onViewModeChange).toHaveBeenCalledWith("graph");

    // WorkflowRunTimeline + WorkflowRunNodeCard with undefined state & non-Enter key
    const onSelectNode = vi.fn();
    render(
      <WorkflowRunTimeline
        nodes={[
          {
            id: "n-empty",
            type: "ai_step",
            name: "Empty Node",
            position: { x: 0, y: 0 },
            data: { kind: "ai_step", variableName: "v1", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: false },
          },
        ]}
        nodeStates={{}}
        selectedNodeId={null}
        onSelectNode={onSelectNode}
      />,
    );
    const trigger = screen.getByRole("button", { name: /Select Empty Node/i });
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(onSelectNode).not.toHaveBeenCalled();
    // KeyDown on child element hits e.target !== e.currentTarget guard
    fireEvent.keyDown(screen.getByText("Empty Node"), { key: "Enter" });
    expect(onSelectNode).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(onSelectNode).toHaveBeenCalledWith("n-empty");
  });

  it("covers WorkflowRunHeader final download success and error, and WorkflowRunApprovalBanner actions", async () => {
    mockDownloadFile.mockRejectedValueOnce(new Error("fail"));
    render(
      <WorkflowRunHeader
        workflowId="wf-1"
        workflowName="My Flow"
        status="completed"
        viewMode="graph"
        onViewModeChange={vi.fn()}
        outputAttachmentIds={["out-1"]}
        attachmentMeta={{
          "out-1": { url: "https://example.com/out.pdf", name: "out.pdf" },
        }}
      />,
    );
    const dlBtn = screen.getByRole("link", { name: /Download Final Result/i });
    await act(async () => {
      fireEvent.click(dlBtn);
    });

    const onSubmitReview = vi.fn();
    const { rerender } = render(
      <WorkflowRunApprovalBanner
        status="awaiting_review"
        pendingApprovals={[]}
        reviewContext={{ nodeId: "n1", nodeName: "Step 1", summary: "Check" }}
        isSubmitting={false}
        onSubmitReview={onSubmitReview}
        onSubmitToolDecisions={vi.fn()}
      />,
    );
    fireEvent.change(
      screen.getByPlaceholderText("Optional review feedback or guidance..."),
      { target: { value: "Looks good" } },
    );

    const onSubmitToolDecisions = vi.fn();
    rerender(
      <WorkflowRunApprovalBanner
        status="awaiting_tool_approval"
        nodeState={{
          status: "awaiting_tool_approval",
          pendingToolApprovals: [
            { approvalId: "ap-1", toolCallId: "tc-1", toolName: "fetch_url", args: { url: "https://a.com" } },
          ],
        } as any}
        isSubmitting={false}
        onSubmitReview={vi.fn()}
        onSubmitToolDecisions={onSubmitToolDecisions}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    fireEvent.click(screen.getByRole("button", { name: "Allow" }));
    fireEvent.click(screen.getByRole("button", { name: /Submit Decisions/i }));
    expect(onSubmitToolDecisions).toHaveBeenCalledWith(true, { "ap-1": true });
    fireEvent.click(screen.getByRole("button", { name: /Reject & Stop/i }));
    expect(onSubmitToolDecisions).toHaveBeenCalledWith(false, { "ap-1": false });
  });

  it("covers remaining branches in WorkflowRunApprovalBanner, FilesSection, and NodeCard", () => {
    render(
      <WorkflowRunApprovalBanner
        status="awaiting_tool_approval"
        nodeState={{
          status: "awaiting_tool_approval",
          pendingToolApprovals: [
            { toolCallId: "tc-fallback", toolName: "search", args: {} },
          ],
        } as any}
        isSubmitting={false}
        onSubmitReview={vi.fn()}
        onSubmitToolDecisions={vi.fn()}
      />,
    );

    render(
      <WorkflowRunFilesSection
        inputAttachmentIds={["in-empty"]}
        outputAttachmentIds={[]}
        attachmentMeta={{
          "in-empty": { url: "https://example.com/in", name: "" },
        }}
      />,
    );
    expect(screen.getByText("Input 1")).toBeInTheDocument();

    render(
      <WorkflowRunNodeCard
        node={{
          id: "n-err",
          type: "http_request",
          name: "HTTP",
          position: { x: 0, y: 0 },
          data: { kind: "http_request", variableName: "http", url: "https://a.com", method: "GET" },
        }}
        state={{
          status: "failed",
          branchTaken: "false",
          httpResponse: { status: 500, statusText: "Server Error" },
          reasoning: "",
          toolCalls: [{ toolCallId: "tc1", toolName: "t", args: {}, state: "result", result: "ok" } as any],
          errorMessage: "Node failed",
        }}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText("Branch: false")).toBeInTheDocument();
    expect(screen.getByText("HTTP 500 Server Error")).toBeInTheDocument();
    expect(screen.getByText("Node failed")).toBeInTheDocument();
  });

  it("handles WorkflowRunHeader download failure and concurrent click guard", async () => {
    let rejectDownload!: (err: Error) => void;
    mockDownloadFile.mockReset();
    mockDownloadFile.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectDownload = reject;
        }),
    );

    render(
      <WorkflowRunHeader
        workflowId="wf-1"
        workflowName="My Flow"
        status="completed"
        dryRun={false}
        viewMode="list"
        onViewModeChange={vi.fn()}
        outputAttachmentIds={["out-1"]}
        attachmentMeta={{
          "out-1": { url: "https://example.com/out.pdf", name: "out.pdf" },
        }}
      />,
    );

    const downloadBtn = screen.getByText(/Download Final Result/i);
    fireEvent.click(downloadBtn);
    // Second click while isDownloading is true should be ignored
    fireEvent.click(downloadBtn);
    expect(mockDownloadFile).toHaveBeenCalledTimes(1);

    rejectDownload(new Error("Download failed"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to download output file");
    });
  });

  it("renders WorkflowRunFilesSection with only inputAttachmentIds and handles non-button click in WorkflowRunNodeCard", () => {
    render(
      <WorkflowRunFilesSection
        inputAttachmentIds={["in-1"]}
        outputAttachmentIds={[]}
        attachmentMeta={{ "in-1": { url: "https://example.com/in.txt", name: "in.txt" } }}
      />,
    );
    expect(screen.getByText("Input Files")).toBeInTheDocument();
    expect(screen.queryByText("Output Files")).not.toBeInTheDocument();

    const onCardClick = vi.fn();
    render(
      <WorkflowRunNodeCard
        node={{
          id: "n-click",
          type: "ai_step",
          position: { x: 0, y: 0 },
          data: { label: "Click Node" },
        }}
        state={{
          status: "completed",
          artifact: { id: "a1", type: "markdown", title: "Doc", content: "Hello" },
        }}
        isSelected={false}
        onClick={onCardClick}
      />,
    );
    const outputBox = document.querySelector('[class*="bg-muted/30"]');
    expect(outputBox).not.toBeNull();
    fireEvent.click(outputBox!);
    expect(onCardClick).toHaveBeenCalledTimes(1);
  });
});
