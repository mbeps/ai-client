import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResizablePanelGroup } from "@/components/ui/resizable";
import { TransformRunFilesSection } from "@/components/workflows/transform-run/transform-run-files-section";
import { TransformRunHeader } from "@/components/workflows/transform-run/transform-run-header";
import { TransformRunPreviewPane } from "@/components/workflows/transform-run/transform-run-preview-pane";
import { TransformStepTimelineItem } from "@/components/workflows/transform-run/transform-step-timeline-item";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { TransformStep } from "@/types/transform/transform-step";

vi.mock("@/components/chat/artifact-panel", () => ({
  ArtifactPanel: ({ artifact }: { artifact: ArtifactData }) => (
    <div data-testid="artifact-panel">{artifact.title}</div>
  ),
}));

vi.mock("@/components/chat/message/tool-call-display", () => ({
  ToolCallDisplay: ({ toolCalls }: { toolCalls: any[] }) => (
    <div data-testid="tool-call-display">{toolCalls.length} tool calls</div>
  ),
}));

describe("Transform Run Components", () => {
  describe("TransformRunHeader", () => {
    it("renders agent name, progress, and status badge", () => {
      render(
        <TransformRunHeader
          agentName="Sales Analyzer"
          createdAt={new Date("2026-01-01T10:00:00Z")}
          status="running"
          progress={50}
          attachmentMeta={{}}
          onApprove={vi.fn()}
          isApproving={false}
        />,
      );

      expect(screen.getByText("Run: Sales Analyzer")).toBeDefined();
      expect(screen.getByText("50%")).toBeDefined();
      expect(screen.getByText("running")).toBeDefined();
    });

    it("renders Approve button when status is awaiting_review and triggers callback", () => {
      const onApprove = vi.fn();
      render(
        <TransformRunHeader
          agentName="Review Agent"
          createdAt={new Date()}
          status="awaiting_review"
          progress={75}
          attachmentMeta={{}}
          onApprove={onApprove}
          isApproving={false}
        />,
      );

      const btn = screen.getByRole("button", { name: /approve/i });
      fireEvent.click(btn);
      expect(onApprove).toHaveBeenCalledOnce();
    });

    it("renders Download Final Result button when completed and output attachment meta exists", () => {
      render(
        <TransformRunHeader
          agentName="Completed Agent"
          createdAt={new Date()}
          status="completed"
          progress={100}
          outputAttachmentIds={["out-final"]}
          attachmentMeta={{
            "out-final": { url: "https://example.com/final.csv", name: "final.csv" },
          }}
          onApprove={vi.fn()}
          isApproving={false}
        />,
      );

      const downloadLink = screen.getByRole("link", { name: /download final result/i });
      expect(downloadLink).toBeDefined();
      expect(downloadLink.getAttribute("href")).toBe("https://example.com/final.csv");
    });
  });

  describe("TransformStepTimelineItem", () => {
    const mockStep: TransformStep = {
      id: "s1",
      name: "Step 1: Parse Data",
      description: "Parses uploaded CSV",
      tool: "spreadsheet",
      order: 0,
      requiresReview: false,
    };

    it("renders step name and status summary", () => {
      render(
        <TransformStepTimelineItem
          step={mockStep}
          index={0}
          state={{ status: "running" }}
          isSelected={false}
          onSelect={vi.fn()}
        />,
      );

      expect(screen.getByText("Step 1: Parse Data")).toBeDefined();
      expect(screen.getByText("AI is working on your request...")).toBeDefined();
    });

    it("calls onSelect when completed step is clicked", () => {
      const onSelect = vi.fn();
      render(
        <TransformStepTimelineItem
          step={mockStep}
          index={0}
          state={{ status: "completed", summary: "Parsed 100 rows" }}
          isSelected={false}
          onSelect={onSelect}
        />,
      );

      expect(screen.getByText("Done")).toBeDefined();
      expect(screen.getByText("Parsed 100 rows")).toBeDefined();

      const stepContainer = screen.getByText("Step 1: Parse Data").closest(".group");
      expect(stepContainer).not.toBeNull();
      if (stepContainer) fireEvent.click(stepContainer);
      expect(onSelect).toHaveBeenCalledWith(0);
    });

    it("renders tool call display when toolCalls are present", () => {
      render(
        <TransformStepTimelineItem
          step={mockStep}
          index={0}
          state={{
            status: "running",
            toolCalls: [
              { toolCallId: "tc-1", toolName: "read_file", args: {} },
            ],
          }}
          isSelected={false}
          onSelect={vi.fn()}
        />,
      );

      expect(screen.getByTestId("tool-call-display")).toBeDefined();
    });
  });

  describe("TransformRunFilesSection", () => {
    it("renders output and input attachments with storage optimization notice", () => {
      render(
        <TransformRunFilesSection
          outputAttachmentIds={["out-1"]}
          inputAttachmentIds={["in-1"]}
          attachmentMeta={{
            "out-1": { url: "https://example.com/out.csv", name: "out.csv" },
            "in-1": { url: "https://example.com/in.csv", name: "in.csv" },
          }}
          isCompleted={true}
        />,
      );

      expect(screen.getByText("Files & Workbooks")).toBeDefined();
      expect(screen.getByText("out.csv")).toBeDefined();
      expect(screen.getByText("Final Result")).toBeDefined();
      expect(screen.getByText("in.csv")).toBeDefined();
      expect(screen.getByText("Input File")).toBeDefined();
      expect(screen.getByText("Storage Optimization")).toBeDefined();
    });
  });

  describe("TransformRunPreviewPane", () => {
    it("renders loading spinner when isLoadingArtifact is true", () => {
      render(
        <ResizablePanelGroup orientation="horizontal">
          <TransformRunPreviewPane
            isLoadingArtifact={true}
            currentArtifact={null}
            isArtifactOpen={true}
            onCloseArtifact={vi.fn()}
            selectedStepIndex={0}
          />
        </ResizablePanelGroup>,
      );

      expect(screen.getByText("Loading preview...")).toBeDefined();
    });

    it("renders artifact panel when artifact is present", () => {
      const artifact: ArtifactData = {
        type: "markdown",
        title: "Report Preview",
        content: "# Ready",
        messageId: "m1",
      };

      render(
        <ResizablePanelGroup orientation="horizontal">
          <TransformRunPreviewPane
            isLoadingArtifact={false}
            currentArtifact={artifact}
            isArtifactOpen={true}
            onCloseArtifact={vi.fn()}
            selectedStepIndex={0}
          />
        </ResizablePanelGroup>,
      );

      expect(screen.getByTestId("artifact-panel")).toBeDefined();
      expect(screen.getByText("Report Preview")).toBeDefined();
    });

    it("renders empty state placeholder when no artifact exists", () => {
      render(
        <ResizablePanelGroup orientation="horizontal">
          <TransformRunPreviewPane
            isLoadingArtifact={false}
            currentArtifact={null}
            isArtifactOpen={true}
            onCloseArtifact={vi.fn()}
            selectedStepIndex={0}
          />
        </ResizablePanelGroup>,
      );

      expect(screen.getByText("Step Preview")).toBeDefined();
      expect(
        screen.getByText(/This step hasn't produced a preview yet/),
      ).toBeDefined();
    });
  });
});

