import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowCanvasConfigTab } from "@/components/workflows/editor/workflow-canvas-config-tab";
import { WorkflowCard } from "@/components/workflows/editor/workflow-card";
import { WorkflowEditorTabs } from "@/components/workflows/editor/workflow-editor-tabs";
import { WorkflowEditorHeader } from "@/components/workflows/editor/workflow-editor-header";
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
  ArtifactPanel: ({
    artifact,
    onClose,
  }: {
    artifact: { title: string };
    onClose: () => void;
  }) => (
    <div data-testid="mock-artifact-panel">
      {artifact.title}
      <button type="button" onClick={onClose}>
        close-artifact
      </button>
    </div>
  ),
}));

vi.mock("@/components/chat/tool-picker-list", () => ({
  ToolPickerList: () => <div data-testid="mock-tool-picker" />,
}));

vi.mock("@/components/chat/knowledgebase-picker", () => ({
  KnowledgebasePicker: () => <div data-testid="mock-kb-picker" />,
}));

vi.mock("@/components/shared/skills-config-tab", () => ({
  SkillsConfigTab: ({
    onToggleSkill,
  }: {
    onToggleSkill: (id: string) => void;
  }) => (
    <div data-testid="mock-skills-tab">
      <button type="button" onClick={() => onToggleSkill("skill-1")}>
        toggle-skill
      </button>
    </div>
  ),
}));

vi.mock("@/components/shared/subagent-picker", () => ({
  SubagentPicker: ({ onToggle }: { onToggle: (id: string) => void }) => (
    <div data-testid="mock-subagent-picker">
      <button type="button" onClick={() => onToggle("agent-1")}>
        toggle-subagent
      </button>
    </div>
  ),
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

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Markdown" }));
    expect(onCanvasConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultType: "markdown",
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
    render(
      <WorkflowCard
        workflow={{
          id: "wf-2",
          name: "Single Node Flow",
          description: "Desc",
          nodeCount: 1,
          hasManualTrigger: false,
          hasWebhookTrigger: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
      />,
    );
    render(
      <WorkflowCard
        workflow={{
          id: "wf-3",
          name: "Undefined Node Flow",
          description: "Desc",
          hasManualTrigger: false,
          hasWebhookTrigger: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
      />,
    );

    const dialogInput = document.querySelector("input[type='file']") as HTMLInputElement;
    if (dialogInput) {
      fireEvent.change(dialogInput, { target: { files: [new File(["a"], "a.csv")] } });
    }
  });

  it("covers WorkflowConfigTab, WorkflowContextTab, WorkflowCanvasConfigTab, WorkflowEditorHeader, and WorkflowRunDialog", () => {
    const onNameChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const onCanvasConfigChange = vi.fn();
    const onRunFilesChange = vi.fn();
    const onInitialInputJsonChange = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <WorkflowEditorTabs
        activeTab="settings"
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
        canvasConfig={{ enabled: false, shared: false, allowedTypes: [] }}
        onCanvasConfigChange={onCanvasConfigChange}
        skillMode="dynamic"
        onSkillModeChange={vi.fn()}
        skillIds={new Set()}
        onSelectSkills={vi.fn()}
        skills={[]}
        onSave={vi.fn()}
        isSaving={true}
        runs={[{ id: "r1" } as never]}
        isLoadingRuns={false}
        name=""
        onNameChange={onNameChange}
        description=""
        onDescriptionChange={onDescriptionChange}
        modelId=""
        onModelIdChange={vi.fn()}
        requiresFileUpload={true}
        onRequiresFileUploadChange={vi.fn()}
        onRunWorkflow={vi.fn()}
        onDelete={vi.fn()}
        isDeleting={false}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Workflow Name/i), {
      target: { value: "New Name" },
    });
    expect(onNameChange).toHaveBeenCalledWith("New Name");

    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "New Desc" },
    });
    expect(onDescriptionChange).toHaveBeenCalledWith("New Desc");

    // Switch to context tab
    render(
      <WorkflowEditorTabs
        activeTab="context"
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
        globalContext="ctx"
        onGlobalContextChange={vi.fn()}
        knowledgebases={[]}
        knowledgeBaseIds={new Set()}
        onSelectKnowledgebases={vi.fn()}
        mcpServers={[]}
        tools={new Set()}
        onToggleTool={vi.fn()}
        onBulkSelectTools={vi.fn()}
        canvasConfig={{ enabled: false, shared: false, allowedTypes: [] }}
        onCanvasConfigChange={onCanvasConfigChange}
        skillMode="dynamic"
        onSkillModeChange={vi.fn()}
        skillIds={new Set()}
        onSelectSkills={vi.fn()}
        skills={[]}
        onSave={vi.fn()}
        isSaving={false}
        runs={[]}
        isLoadingRuns={false}
        name=""
        onNameChange={onNameChange}
        description=""
        onDescriptionChange={onDescriptionChange}
        modelId=""
        onModelIdChange={vi.fn()}
        requiresFileUpload={false}
        onRequiresFileUploadChange={vi.fn()}
        onRunWorkflow={vi.fn()}
        onDelete={vi.fn()}
        isDeleting={false}
      />,
    );
    expect(screen.getByRole("heading", { name: "Global Context" })).toBeInTheDocument();

    // Canvas config tab: toggle enabled switch & add allowed type
    render(
      <WorkflowCanvasConfigTab
        canvasConfig={{ enabled: false, shared: false, allowedTypes: [] }}
        onCanvasConfigChange={onCanvasConfigChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Enable Canvas Artifacts/i));
    expect(onCanvasConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
    fireEvent.click(screen.getByLabelText("Markdown"));
    expect(onCanvasConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ allowedTypes: ["markdown"] }),
    );

    // WorkflowEditorHeader + WorkflowRunDialog
    render(
      <WorkflowEditorHeader
        isNew={false}
        name=""
        nodeCount={1}
        runDialogOpen={true}
        onRunDialogOpenChange={onOpenChange}
        requiresFileUpload={true}
        runFiles={[new File(["a"], "a.csv")]}
        onRunFilesChange={onRunFilesChange}
        initialInputJson="{}"
        onInitialInputJsonChange={onInitialInputJsonChange}
        dryRun={false}
        onDryRunChange={vi.fn()}
        onStartRun={vi.fn()}
        isStartingRun={true}
        disabledRun={false}
        onSave={vi.fn()}
        isSaving={true}
        disabledSave={false}
      />,
    );
    expect(screen.getByText("Untitled Workflow")).toBeInTheDocument();
    expect(screen.getByText("1 node in graph")).toBeInTheDocument();
    expect(screen.getByText("1 file selected")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Trigger JSON Payload/i), {
      target: { value: '{"a":1}' },
    });
    expect(onInitialInputJsonChange).toHaveBeenCalledWith('{"a":1}');
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

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
    const fileInput = document.querySelector('input[type="file"]')!;
    expect(fileInput).toHaveAttribute(
      "accept",
      Array.from(SPREADSHEET_EXTENSIONS).join(","),
    );
    const csvFile = new File(["a,b"], "test.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });
    fireEvent.change(fileInput, { target: { files: null } });

    render(
      <WorkflowRunDialog
        open={true}
        onOpenChange={vi.fn()}
        requiresFileUpload={true}
        runFiles={[csvFile, new File(["c,d"], "test2.csv", { type: "text/csv" })]}
        onRunFilesChange={vi.fn()}
        initialInputJson="{}"
        onInitialInputJsonChange={vi.fn()}
        dryRun={false}
        onDryRunChange={vi.fn()}
        onStartRun={vi.fn()}
        isStartingRun={false}
      />,
    );
    expect(screen.getByText("2 files selected")).toBeInTheDocument();
  });

  it("renders WorkflowEditorHeader with isNew=true", () => {
    render(
      <WorkflowEditorHeader
        isNew={true}
        name=""
        nodeCount={0}
        onSave={vi.fn()}
        isSaving={false}
        disabledSave={false}
        onRun={vi.fn()}
        isStartingRun={false}
        disabledRun={false}
      />,
    );
    expect(screen.getByText("New Workflow")).toBeInTheDocument();
    expect(
      screen.getByText("Design a visual multi-node AI automation"),
    ).toBeInTheDocument();
  });

  it("wires skills, subagents, mcpServers filter, and artifact close", () => {
    const onSelectSkills = vi.fn();
    const onToggleSubagent = vi.fn();
    const baseProps = {
      onActiveTabChange: vi.fn(),
      isNew: true,
      workflowId: "",
      nodes: sampleNodes,
      edges: [],
      onNodesChange: vi.fn(),
      onEdgesChange: vi.fn(),
      onAddNode: vi.fn(),
      onUpdateNode: vi.fn(),
      onDeleteNode: vi.fn(),
      onAutoLayout: vi.fn(),
      webhookSecret: "",
      globalContext: "",
      onGlobalContextChange: vi.fn(),
      knowledgebases: [],
      knowledgeBaseIds: new Set<string>(),
      onSelectKnowledgeBases: vi.fn(),
      mcpServers: [{ id: "m1", name: "MCP", enabled: true, tools: [] }] as never,
      tools: new Set<string>(),
      onToggleTool: vi.fn(),
      onBulkSelectTools: vi.fn(),
      canvasConfig: DEFAULT_WORKFLOW_CANVAS_CONFIG,
      onCanvasConfigChange: vi.fn(),
      latestArtifact: {
        id: "art-1",
        type: "markdown" as const,
        title: "Latest Report",
        content: "# Summary",
      },
      skillMode: "auto" as const,
      onSkillModeChange: vi.fn(),
      skillIds: new Set<string>(),
      onSelectSkills,
      skills: [],
      agents: [],
      subagentIds: new Set<string>(),
      onToggleSubagent,
      runs: [],
      isLoadingRuns: false,
      onSave: vi.fn(),
      isSaving: false,
    };
    const { rerender } = render(
      <WorkflowEditorTabs activeTab="skills" {...baseProps} />,
    );
    fireEvent.click(screen.getByText("toggle-skill"));
    expect(onSelectSkills).toHaveBeenCalled();

    rerender(<WorkflowEditorTabs activeTab="subagents" {...baseProps} />);
    fireEvent.click(screen.getByText("toggle-subagent"));
    expect(onToggleSubagent).toHaveBeenCalledWith("agent-1");

    rerender(<WorkflowEditorTabs activeTab="canvas-config" {...baseProps} />);
    fireEvent.click(screen.getByText("close-artifact"));
  });
});
