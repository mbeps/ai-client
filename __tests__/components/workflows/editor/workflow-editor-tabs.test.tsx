import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowCanvasConfigTab } from "@/components/workflows/editor/workflow-canvas-config-tab";
import { WorkflowCard } from "@/components/workflows/editor/workflow-card";
import { WorkflowEditorTabs } from "@/components/workflows/editor/workflow-editor-tabs";
import { WorkflowRunDialog } from "@/components/workflows/editor/workflow-run-dialog";
import { SPREADSHEET_EXTENSIONS } from "@/config/attachments";
import {
  DEFAULT_WORKFLOW_CANVAS_CONFIG,
  type WorkflowNode,
} from "@/types/workflows/workflow";

vi.mock("@/components/workflows/editor/workflow-options", () => ({
  WorkflowOptions: () => <div data-testid="mock-workflow-options" />,
}));

vi.mock("@/components/workflows/canvas/workflow-canvas", () => ({
  WorkflowCanvas: () => <div data-testid="mock-workflow-canvas">Canvas</div>,
}));

vi.mock("@/components/chat/artifact-panel", () => ({
  ArtifactPanel: ({ artifact }: { artifact: { title: string } }) => (
    <div data-testid="mock-artifact-panel">{artifact.title}</div>
  ),
}));

vi.mock("@/components/chat/tool-picker-list", () => ({
  ToolPickerList: () => <div data-testid="mock-tool-picker" />,
}));

vi.mock("@/components/chat/knowledgebase-picker", () => ({
  KnowledgebasePicker: () => <div data-testid="mock-kb-picker" />,
}));

vi.mock("@/components/shared/skills-config-tab", () => ({
  SkillsConfigTab: () => <div data-testid="mock-skills-tab" />,
}));

vi.mock("@/components/shared/subagent-picker", () => ({
  SubagentPicker: () => <div data-testid="mock-subagent-picker" />,
}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: () => <div data-testid="mock-markdown-editor" />,
}));

const sampleNodes: WorkflowNode[] = [
  {
    id: "n1",
    type: "ai_step",
    name: "Step One",
    position: { x: 0, y: 0 },
    data: {
      kind: "ai_step",
      variableName: "step1",
      prompt: "Go",
      mcpServerIds: [],
      toolIds: [],
      requiresReview: false,
    },
  },
];

describe("Workflow Editor Tabs & Canvas Config", () => {
  it("renders WorkflowCanvasConfigTab, toggles format selection, and previews latest artifact", () => {
    const onCanvasConfigChange = vi.fn();

    render(
      <WorkflowCanvasConfigTab
        canvasConfig={DEFAULT_WORKFLOW_CANVAS_CONFIG}
        onCanvasConfigChange={onCanvasConfigChange}
        latestArtifact={{
          id: "art-1",
          type: "markdown",
          title: "Latest Report",
          content: "# Summary",
        }}
      />,
    );

    expect(screen.getByTestId("mock-artifact-panel")).toHaveTextContent(
      "Latest Report",
    );

    fireEvent.click(screen.getByLabelText("Spreadsheet"));
    expect(onCanvasConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedTypes: ["markdown", "html", "mermaid"],
      }),
    );

    fireEvent.click(screen.getByLabelText("Shared Canvas Artifact"));
    expect(onCanvasConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sharedCanvas: false,
      }),
    );
  });

  it("renders all 10 sidebar tabs in WorkflowEditorTabs without Approvals", () => {
    render(
      <WorkflowEditorTabs
        activeTab="canvas"
        onActiveTabChange={vi.fn()}
        isNew={false}
        workflowId="wf-1"
        nodes={sampleNodes}
        edges={[]}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
        onAddNode={vi.fn()}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onAutoLayout={vi.fn()}
        webhookSecret="sec-1"
        globalContext=""
        onGlobalContextChange={vi.fn()}
        knowledgebases={[]}
        knowledgeBaseIds={new Set()}
        onSelectKnowledgebases={vi.fn()}
        mcpServers={[]}
        tools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelectTools={vi.fn()}
        canvasConfig={DEFAULT_WORKFLOW_CANVAS_CONFIG}
        onCanvasConfigChange={vi.fn()}
        skillMode="dynamic"
        onSkillModeChange={vi.fn()}
        skillIds={new Set()}
        onSelectSkills={vi.fn()}
        skills={[]}
        onSave={vi.fn()}
        isSaving={false}
        runs={[]}
        isLoadingRuns={false}
        name="Test Flow"
        onNameChange={vi.fn()}
        description=""
        onDescriptionChange={vi.fn()}
        modelId=""
        onModelIdChange={vi.fn()}
        requiresFileUpload={false}
        onRequiresFileUploadChange={vi.fn()}
        onDelete={vi.fn()}
        isDeleting={false}
      />,
    );

    expect(screen.getByText("Workflow Canvas")).toBeInTheDocument();
    expect(screen.queryByText("Approvals")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Canvas$/i })).toBeInTheDocument();
    expect(screen.getByText("Danger Zone")).toBeInTheDocument();
    expect(screen.getByTestId("mock-workflow-canvas")).toBeInTheDocument();

    const tabList = screen.getByRole("tablist");
    const classes = tabList.className.split(/\s+/);
    expect(classes).toContain("h-auto");
    expect(classes).not.toContain("h-full");
  });

  it("clears defaultType to any when its format is unchecked in WorkflowCanvasConfigTab", () => {
    const onCanvasConfigChange = vi.fn();
    render(
      <WorkflowCanvasConfigTab
        canvasConfig={{
          enabled: true,
          allowedTypes: ["markdown", "spreadsheet"],
          defaultType: "spreadsheet",
        }}
        onCanvasConfigChange={onCanvasConfigChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Spreadsheet"));
    expect(onCanvasConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedTypes: ["markdown"],
        defaultType: "any",
      }),
    );
  });

  it("hides Run Workflow on overview when isNew, adds accessible labels on WorkflowCard, and aligns WorkflowRunDialog accept", () => {
    render(
      <WorkflowEditorTabs
        activeTab="overview"
        onActiveTabChange={vi.fn()}
        isNew={true}
        workflowId="wf-new"
        nodes={sampleNodes}
        edges={[]}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
        onAddNode={vi.fn()}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onAutoLayout={vi.fn()}
        webhookSecret=""
        globalContext=""
        onGlobalContextChange={vi.fn()}
        knowledgebases={[]}
        knowledgeBaseIds={new Set()}
        onSelectKnowledgebases={vi.fn()}
        mcpServers={[]}
        tools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelectTools={vi.fn()}
        canvasConfig={DEFAULT_WORKFLOW_CANVAS_CONFIG}
        onCanvasConfigChange={vi.fn()}
        skillMode="dynamic"
        onSkillModeChange={vi.fn()}
        skillIds={new Set()}
        onSelectSkills={vi.fn()}
        skills={[]}
        onSave={vi.fn()}
        isSaving={false}
        runs={[]}
        isLoadingRuns={false}
        name="Unsaved Flow"
        onNameChange={vi.fn()}
        description=""
        onDescriptionChange={vi.fn()}
        modelId=""
        onModelIdChange={vi.fn()}
        requiresFileUpload={false}
        onRequiresFileUploadChange={vi.fn()}
        onRunWorkflow={vi.fn()}
        onDelete={vi.fn()}
        isDeleting={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Run Workflow/i }),
    ).not.toBeInTheDocument();

    render(
      <WorkflowCard
        workflow={{
          id: "wf-1",
          name: "Demo Flow",
          description: "Desc",
          nodeCount: 2,
          hasManualTrigger: true,
          hasWebhookTrigger: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Edit Workflow" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Runs" })).toBeInTheDocument();

    render(
      <WorkflowRunDialog
        open={true}
        onOpenChange={vi.fn()}
        requiresFileUpload={true}
        runFiles={[]}
        onRunFilesChange={vi.fn()}
        initialInputJson="{}"
        onInitialInputJsonChange={vi.fn()}
        dryRun={false}
        onDryRunChange={vi.fn()}
        onStartRun={vi.fn()}
        isStartingRun={false}
      />,
    );
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toHaveAttribute(
      "accept",
      Array.from(SPREADSHEET_EXTENSIONS).join(","),
    );
  });
});
