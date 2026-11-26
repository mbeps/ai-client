import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workflows/dag-planner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workflows/dag-planner")>();
  return {
    ...actual,
    validateAndSortWorkflowGraph: vi.fn(actual.validateAndSortWorkflowGraph),
  };
});
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
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/actions/workflows/regenerate-webhook-secret", () => ({
  regenerateWebhookSecret: vi.fn().mockResolvedValue({ ok: false, error: { message: "err" } }),
}));
vi.mock("@/actions/workflows/create-workflow", () => ({
  createWorkflow: vi.fn().mockResolvedValue({ ok: false, error: { message: "err" } }),
}));
vi.mock("@/actions/workflows/update-workflow", () => ({
  updateWorkflow: vi.fn().mockResolvedValue({ ok: false, error: { message: "err" } }),
}));
vi.mock("@/actions/workflows/delete-workflow", () => ({
  deleteWorkflow: vi.fn().mockResolvedValue({ ok: false, error: { message: "err" } }),
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

  it("handles add, delete, autoLayout, and regenerateWebhookSecret", async () => {
    const handleApiError = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowEditor({ id: "wf-1", isNew: false, handleApiError }),
    );

    act(() => {
      result.current.handleAddNode("ai_step", { x: 10, y: 20 });
      result.current.handleAddNode("manual_trigger", { x: 0, y: 0 }, makeTriggerNode(true));
      result.current.handleDeleteNode("trigger-1");
      result.current.handleAutoLayout();
    });
    expect(mockFormState.setNodes).toHaveBeenCalled();
    expect(mockFormState.setEdges).toHaveBeenCalled();

    await act(async () => {
      await result.current.handleRegenerateWebhookSecret();
    });
  });

  it("handles handleSave validation, create, update, and handleDelete", async () => {
    const handleApiError = vi.fn();
    mockFormState.name = "   ";
    const { result, rerender } = renderHook(
      ({ isNew }: { isNew: boolean }) =>
        useWorkflowEditor({ id: "wf-1", isNew, handleApiError }),
      { initialProps: { isNew: true } },
    );

    await act(async () => {
      await result.current.handleSave();
    });

    mockFormState.name = "My Workflow";
    await act(async () => {
      await result.current.handleSave();
    });

    rerender({ isNew: false });
    await act(async () => {
      await result.current.handleSave();
      await result.current.handleDelete();
    });
  });

  it("covers edge filtering, non-matching nodes, regenerateWebhookSecret, and save/delete success & error paths", async () => {
    const { regenerateWebhookSecret } = await import(
      "@/actions/workflows/regenerate-webhook-secret"
    );
    const { createWorkflow } = await import("@/actions/workflows/create-workflow");
    const { updateWorkflow } = await import("@/actions/workflows/update-workflow");
    const { deleteWorkflow } = await import("@/actions/workflows/delete-workflow");

    const aiNode: WorkflowNode = {
      id: "ai-1",
      type: "ai_step",
      name: "AI Step",
      position: { x: 200, y: 180 },
      data: {
        kind: "ai_step",
        variableName: "step1",
        prompt: "Go",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
    };
    mockFormState.nodes = [makeTriggerNode(false), aiNode];
    mockFormState.edges = [
      { id: "e1", sourceNodeId: "trigger-1", targetNodeId: "ai-1", sourceHandle: "main", targetHandle: "main" },
      { id: "e2", sourceNodeId: "ai-1", targetNodeId: "trigger-1", sourceHandle: "main", targetHandle: "main" },
      { id: "e3", sourceNodeId: "ai-1", targetNodeId: "other", sourceHandle: "main", targetHandle: "main" },
    ];

    const handleApiError = vi.fn();
    const { result, rerender } = renderHook(
      ({ isNew }: { isNew: boolean }) =>
        useWorkflowEditor({ id: "wf-1", isNew, handleApiError }),
      { initialProps: { isNew: true } },
    );

    // isNew=true: handleRegenerateWebhookSecret returns early
    await act(async () => {
      await result.current.handleRegenerateWebhookSecret();
    });
    expect(regenerateWebhookSecret).not.toHaveBeenCalled();

    // handleUpdateNode with non-matching node
    act(() => {
      result.current.handleUpdateNode("ai-1", { name: "Updated AI" });
      result.current.setRequiresFileUpload(true);
      result.current.handleDeleteNode("trigger-1");
    });

    // Graph cycle error (Error instance)
    mockFormState.nodes = [makeTriggerNode(false), aiNode];
    mockFormState.edges = [
      { id: "e1", sourceNodeId: "trigger-1", targetNodeId: "ai-1", sourceHandle: "main", targetHandle: "main" },
      { id: "e2", sourceNodeId: "ai-1", targetNodeId: "trigger-1", sourceHandle: "main", targetHandle: "main" },
    ];
    mockFormState.name = "Valid Name";
    await act(async () => {
      await result.current.handleSave();
    });

    // Valid graph, createWorkflow success
    mockFormState.edges = [
      { id: "e1", sourceNodeId: "trigger-1", targetNodeId: "ai-1", sourceHandle: "main", targetHandle: "main" },
    ];
    vi.mocked(createWorkflow).mockResolvedValueOnce({
      ok: true,
      value: { id: "new-wf-id" } as never,
    });
    await act(async () => {
      await result.current.handleSave();
    });
    expect(mockPush).toHaveBeenCalled();

    // isNew=false: regenerateWebhookSecret success, updateWorkflow success & throw, deleteWorkflow success & throw
    rerender({ isNew: false });
    vi.mocked(regenerateWebhookSecret).mockResolvedValueOnce({
      ok: true,
      value: { webhookSecret: "sec-123" },
    });
    await act(async () => {
      await result.current.handleRegenerateWebhookSecret();
    });
    expect(mockFormState.setWebhookSecret).toHaveBeenCalledWith("sec-123");

    vi.mocked(updateWorkflow).mockResolvedValueOnce({ ok: true, value: {} as never });
    await act(async () => {
      await result.current.handleSave();
    });

    vi.mocked(updateWorkflow).mockRejectedValueOnce(new Error("boom"));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(handleApiError).toHaveBeenCalled();

    vi.mocked(deleteWorkflow).mockResolvedValueOnce({ ok: true, value: undefined as never });
    await act(async () => {
      await result.current.handleDelete();
    });

    vi.mocked(deleteWorkflow).mockRejectedValueOnce(new Error("del boom"));
    await act(async () => {
      await result.current.handleDelete();
    });
  });

  it("handles deleting non-manual_trigger node and non-Error graph validation throw", async () => {
    const { validateAndSortWorkflowGraph } = await import("@/lib/workflows/dag-planner");
    const { toast } = await import("sonner");

    mockFormState.nodes = [
      makeTriggerNode(false),
      {
        id: "ai-1",
        type: "ai_step",
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
    mockFormState.edges = [];

    const { result } = renderHook(() =>
      useWorkflowEditor({ id: "wf-1", isNew: false, handleApiError: vi.fn() }),
    );

    act(() => {
      result.current.handleDeleteNode("ai-1");
    });
    expect(mockFormState.setRequiresFileUpload).not.toHaveBeenCalled();

    vi.mocked(validateAndSortWorkflowGraph).mockImplementationOnce(() => {
      throw "non-error-cycle";
    });
    await act(async () => {
      await result.current.handleSave();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Workflow graph contains invalid connections or cycles",
    );
  });
});
