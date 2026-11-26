import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoLayoutWorkflowNodes,
  buildWorkflowPayload,
  uploadWorkflowRunFiles,
} from "@/components/workflows/editor/workflow-editor-helpers";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflows/workflow";

const mockUploadWorkflowRunInput = vi.hoisted(() => vi.fn());

vi.mock("@/actions/workflow-runs/upload-workflow-run-input", () => ({
  uploadWorkflowRunInput: mockUploadWorkflowRunInput,
}));

describe("workflow-editor-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("autoLayoutWorkflowNodes lays out connected nodes and ignores unknown edge endpoints", () => {
    const nodes = [
      { id: "n1", position: { x: 0, y: 0 }, data: { kind: "manual_trigger", label: "Start" } },
      { id: "n2", position: { x: 0, y: 0 }, data: { kind: "llm_step", label: "Step" } },
      { id: "n3", position: { x: 0, y: 0 }, data: { kind: "llm_step", label: "Branch" } },
    ] as unknown as WorkflowNode[];

    const edges = [
      { id: "e1", sourceNodeId: "n1", targetNodeId: "n2" },
      { id: "e2", sourceNodeId: "n1", targetNodeId: "n3" },
      { id: "e-missing", sourceNodeId: "missing", targetNodeId: "n2" },
    ] as unknown as WorkflowEdge[];

    const laidOut = autoLayoutWorkflowNodes(nodes, edges);
    expect(laidOut[0].position).toEqual({ x: 80, y: 100 });
    expect(laidOut[1].position).toEqual({ x: 420, y: 100 });
    expect(laidOut[2].position).toEqual({ x: 420, y: 280 });
  });

  it("buildWorkflowPayload serializes empty and non-empty fields", () => {
    const emptyPayload = buildWorkflowPayload({
      name: "WF",
      description: "   ",
      globalContext: "",
      modelId: "  ",
      reasoningEffort: "high",
      tools: new Set(["t1"]),
      skillMode: "dynamic",
      skillIds: new Set(["s1"]),
      knowledgeBaseIds: new Set(["k1"]),
      subagentIds: ["sub1"],
      requiresFileUpload: false,
      canvasConfig: {} as never,
      approvalConfig: {} as never,
      nodes: [],
      edges: [],
    });

    expect(emptyPayload.description).toBeUndefined();
    expect(emptyPayload.globalContext).toBeUndefined();
    expect(emptyPayload.modelId).toBeUndefined();
    expect(emptyPayload.reasoningEffort).toBeNull();

    const fullPayload = buildWorkflowPayload({
      name: "WF",
      description: " Desc ",
      globalContext: " Ctx ",
      modelId: " gpt-4 ",
      reasoningEffort: "medium",
      tools: new Set(),
      skillMode: "manual",
      skillIds: new Set(),
      knowledgeBaseIds: new Set(),
      subagentIds: [],
      requiresFileUpload: true,
      canvasConfig: {} as never,
      approvalConfig: {} as never,
      nodes: [],
      edges: [],
    });

    expect(fullPayload.description).toBe("Desc");
    expect(fullPayload.globalContext).toBe("Ctx");
    expect(fullPayload.modelId).toBe("gpt-4");
    expect(fullPayload.reasoningEffort).toBe("medium");
  });

  it("uploadWorkflowRunFiles handles empty, success, and failure", async () => {
    await expect(uploadWorkflowRunFiles([])).resolves.toEqual({ ok: true, value: [] });
    expect(mockUploadWorkflowRunInput).not.toHaveBeenCalled();

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    mockUploadWorkflowRunInput.mockResolvedValueOnce({
      ok: false,
      error: { message: "Too large" },
    });
    await expect(uploadWorkflowRunFiles([file])).resolves.toEqual({
      ok: false,
      error: { message: "Too large" },
    });

    mockUploadWorkflowRunInput.mockResolvedValueOnce({
      ok: true,
      value: [{ id: "att-1" }, { id: "att-2" }],
    });
    await expect(uploadWorkflowRunFiles([file])).resolves.toEqual({
      ok: true,
      value: ["att-1", "att-2"],
    });
  });

  it("createDefaultWorkflowNode creates all node types and deduplicates variableName", async () => {
    const { createDefaultWorkflowNode } = await import(
      "@/components/workflows/editor/workflow-editor-helpers"
    );
    const manual1 = createDefaultWorkflowNode("manual_trigger", { x: 0, y: 0 }, []);
    const manual2 = createDefaultWorkflowNode("manual_trigger", { x: 0, y: 0 }, [manual1]);
    expect(manual2.data.variableName).toBe("trigger2");

    const webhook = createDefaultWorkflowNode("webhook_trigger", { x: 0, y: 0 }, []);
    expect(webhook.type).toBe("webhook_trigger");

    const ai = createDefaultWorkflowNode("ai_step", { x: 0, y: 0 }, []);
    expect(ai.type).toBe("ai_step");

    const cond = createDefaultWorkflowNode("if_condition", { x: 0, y: 0 }, []);
    expect(cond.type).toBe("if_condition");

    const http = createDefaultWorkflowNode("http_request", { x: 0, y: 0 }, []);
    expect(http.type).toBe("http_request");
  });

  it("hydrateWorkflowFormState handles missing optional fields and syncs requiresFileUpload to manual_trigger", async () => {
    const { hydrateWorkflowFormState } = await import(
      "@/components/workflows/editor/workflow-editor-helpers"
    );
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

    hydrateWorkflowFormState(
      {
        id: "wf-1",
        name: "WF",
        requiresFileUpload: true,
        nodes: [
          {
            id: "t1",
            type: "manual_trigger",
            name: "Trigger",
            position: { x: 0, y: 0 },
            data: { kind: "manual_trigger", variableName: "trigger", requiresFileUpload: false },
          },
          {
            id: "s1",
            type: "ai_step",
            name: "Step",
            position: { x: 100, y: 0 },
            data: { kind: "ai_step", variableName: "step1", prompt: "Go", mcpServerIds: [], toolIds: [], requiresReview: false },
          },
        ],
      } as never,
      setters,
    );
    expect(setters.setNodes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "t1",
          data: expect.objectContaining({ requiresFileUpload: true }),
        }),
      ]),
    );

    hydrateWorkflowFormState({ id: "wf-2", name: "Empty" } as never, setters);
    expect(setters.setNodes).toHaveBeenCalledWith([]);
    expect(setters.setEdges).toHaveBeenCalledWith([]);
  });

  it("autoLayoutNodes handles diamond DAGs where a node has multiple incoming edges", () => {
    const nodes = [
      { id: "a", type: "trigger", position: { x: 0, y: 0 }, data: {} },
      { id: "b", type: "ai_step", position: { x: 0, y: 0 }, data: {} },
      { id: "c", type: "ai_step", position: { x: 0, y: 0 }, data: {} },
      { id: "d", type: "ai_step", position: { x: 0, y: 0 }, data: {} },
    ] as unknown as WorkflowNode[];
    const edges = [
      { id: "e1", sourceNodeId: "a", targetNodeId: "b", sourceHandle: "main", targetHandle: "main" },
      { id: "e2", sourceNodeId: "a", targetNodeId: "c", sourceHandle: "main", targetHandle: "main" },
      { id: "e3", sourceNodeId: "b", targetNodeId: "d", sourceHandle: "main", targetHandle: "main" },
      { id: "e4", sourceNodeId: "c", targetNodeId: "d", sourceHandle: "main", targetHandle: "main" },
    ] as unknown as WorkflowEdge[];

    const laidOut = autoLayoutWorkflowNodes(nodes, edges);
    const nodeD = laidOut.find((n) => n.id === "d");
    expect(nodeD?.position.x).toBe(80 + 2 * 340);
  });
});
