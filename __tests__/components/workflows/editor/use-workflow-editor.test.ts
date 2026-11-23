import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkflowEditor } from "@/components/workflows/editor/use-workflow-editor";
import { hydrateWorkflowFormState } from "@/components/workflows/editor/workflow-editor-helpers";
import {
  DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  DEFAULT_WORKFLOW_CANVAS_CONFIG,
  type WorkflowNode,
  type WorkflowWithGraph,
} from "@/types/workflows/workflow";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({ models: [{ id: "gpt-4o" }], isLoading: false }),
}));

vi.mock("@/components/workflows/editor/use-workflow-runs", () => ({
  useWorkflowRuns: () => ({ runs: [], isLoadingRuns: false }),
}));

const mockUseWorkflowRunDialog = vi.fn();
vi.mock("@/components/workflows/editor/use-workflow-run-dialog", () => ({
  useWorkflowRunDialog: (params: unknown) => {
    mockUseWorkflowRunDialog(params);
    return {
      runDialogOpen: false,
      setRunDialogOpen: vi.fn(),
      runFiles: [],
      setRunFiles: vi.fn(),
      initialInputJson: "",
      setInitialInputJson: vi.fn(),
      dryRun: false,
      setDryRun: vi.fn(),
      isStartingRun: false,
      handleStartRun: vi.fn(),
    };
  },
}));

vi.mock("@/components/workflows/canvas/workflow-editor-store", () => ({
  useWorkflowEditorStore: () => ({ setSelectedNodeId: vi.fn() }),
}));

const mockFormState = {
  name: "Spreadsheets",
  setName: vi.fn(),
  description: "",
  setDescription: vi.fn(),
  globalContext: "",
  setGlobalContext: vi.fn(),
  modelId: "gpt-4o",
  setModelId: vi.fn(),
  tools: new Set<string>(),
  setTools: vi.fn(),
  skillMode: "dynamic" as const,
  setSkillMode: vi.fn(),
  skillIds: new Set<string>(),
  setSkillIds: vi.fn(),
  knowledgeBaseIds: new Set<string>(),
  setKnowledgeBaseIds: vi.fn(),
  subagentIds: [] as string[],
  setSubagentIds: vi.fn(),
  requiresFileUpload: false,
  setRequiresFileUpload: vi.fn(),
  canvasConfig: DEFAULT_WORKFLOW_CANVAS_CONFIG,
  setCanvasConfig: vi.fn(),
  approvalConfig: DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  setApprovalConfig: vi.fn(),
  webhookSecret: null as string | null,
  setWebhookSecret: vi.fn(),
  nodes: [] as WorkflowNode[],
  setNodes: vi.fn(),
  edges: [],
  setEdges: vi.fn(),
  mcpServers: [],
  knowledgebases: [],
  skills: [],
  agents: [],
  isLoading: false,
  handleToggleTool: vi.fn(),
  handleBulkSelectTools: vi.fn(),
  handleToggleSubagent: vi.fn(),
};

vi.mock("@/components/workflows/editor/use-workflow-editor-form", () => ({
  useWorkflowEditorForm: () => mockFormState,
}));

function makeTriggerNode(requiresFileUpload: boolean): WorkflowNode {
  return {
    id: "trigger-1",
    type: "manual_trigger",
    name: "Manual Trigger",
    position: { x: 80, y: 180 },
    data: {
      kind: "manual_trigger",
      variableName: "trigger",
      requiresFileUpload,
    },
  };
}

describe("workflow requiresFileUpload synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormState.requiresFileUpload = false;
    mockFormState.nodes = [makeTriggerNode(false)];
    mockFormState.setRequiresFileUpload = vi.fn((val: boolean) => {
      mockFormState.requiresFileUpload = val;
    });
    mockFormState.setNodes = vi.fn((nodes: WorkflowNode[]) => {
      mockFormState.nodes = nodes;
    });
  });

  it("hydrates requiresFileUpload as true when manual_trigger node has requiresFileUpload true", () => {
    const setters = {
      setName: vi.fn(),
      setDescription: vi.fn(),
      setGlobalContext: vi.fn(),
      setModelId: vi.fn(),
      setTools: vi.fn(),
      setSkillMode: vi.fn(),
      setSkillIds: vi.fn(),
      setKnowledgeBaseIds: vi.fn(),
      setSubagentIds: vi.fn(),
      setRequiresFileUpload: vi.fn(),
      setCanvasConfig: vi.fn(),
      setApprovalConfig: vi.fn(),
      setWebhookSecret: vi.fn(),
      setNodes: vi.fn(),
      setEdges: vi.fn(),
    };

    const workflow = {
      id: "wf-1",
      name: "Spreadsheets",
      description: null,
      globalContext: null,
      modelId: null,
      tools: [],
      skillMode: "dynamic",
      skillIds: [],
      knowledgeBaseIds: [],
      subagentIds: [],
      requiresFileUpload: false,
      canvasConfig: DEFAULT_WORKFLOW_CANVAS_CONFIG,
      approvalConfig: DEFAULT_WORKFLOW_APPROVAL_CONFIG,
      webhookSecret: null,
      nodes: [makeTriggerNode(true)],
      edges: [],
    } as unknown as WorkflowWithGraph;

    hydrateWorkflowFormState(workflow, setters);

    expect(setters.setRequiresFileUpload).toHaveBeenCalledWith(true);
  });

  it("syncs requiresFileUpload when manual_trigger node is updated on canvas", () => {
    const { result, rerender } = renderHook(() =>
      useWorkflowEditor({
        id: "wf-1",
        isNew: false,
        handleApiError: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleUpdateNode("trigger-1", {
        data: {
          kind: "manual_trigger",
          variableName: "trigger",
          requiresFileUpload: true,
        },
      });
    });
    rerender();

    expect(mockFormState.setRequiresFileUpload).toHaveBeenCalledWith(true);
    expect(mockUseWorkflowRunDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ requiresFileUpload: true }),
    );
  });

  it("syncs manual_trigger node when setRequiresFileUpload is called from settings", () => {
    const { result } = renderHook(() =>
      useWorkflowEditor({
        id: "wf-1",
        isNew: false,
        handleApiError: vi.fn(),
      }),
    );

    act(() => {
      result.current.setRequiresFileUpload(true);
    });

    expect(mockFormState.setRequiresFileUpload).toHaveBeenCalledWith(true);
    expect(mockFormState.setNodes).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "trigger-1",
        data: expect.objectContaining({ requiresFileUpload: true }),
      }),
    ]);
  });
});
