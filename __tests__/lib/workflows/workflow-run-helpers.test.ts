import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeNodeWithGates } from "@/lib/workflows/workflow-run-gates";
import { executeSingleWorkflowNode } from "@/lib/workflows/workflow-run-helpers";
import type { Agent } from "@/types/agent/agent";
import type { WorkflowNode } from "@/types/workflows/workflow";

const mockSelectFromWhere = vi.fn();
const mockSelectFrom = vi.fn(() => ({ where: mockSelectFromWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

const mockResolveLinkedSubagents = vi.fn();
vi.mock("@/lib/agents/resolve-linked-subagents", () => ({
  resolveLinkedSubagents: (...args: unknown[]) =>
    mockResolveLinkedSubagents(...args),
}));

const mockLoadWorkflowContext = vi.fn();
vi.mock("@/lib/workflows/load-workflow-context", () => ({
  loadWorkflowContext: (...args: unknown[]) => mockLoadWorkflowContext(...args),
}));

const mockExecuteAiStepNode = vi.fn();
vi.mock("@/lib/workflows/execute-ai-step-node", () => ({
  executeAiStepNode: (...args: unknown[]) => mockExecuteAiStepNode(...args),
}));

vi.mock("@/lib/workflows/build-file-context", () => ({
  buildFileContext: vi.fn().mockResolvedValue({ attachmentRows: [] }),
}));

const mockExecuteFilterNode = vi.fn();
vi.mock("@/lib/workflows/execute-filter-node", () => ({
  executeFilterNode: (...args: unknown[]) => mockExecuteFilterNode(...args),
}));

const mockResolveProvider = vi.fn();
vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: (...args: unknown[]) => mockResolveProvider(...args),
}));

const baseWorkflowRow = {
  id: "wf-1",
  name: "Test Workflow",
  description: null,
  modelId: "wf-model",
  reasoningEffort: "low" as const,
  knowledgeBaseIds: ["wf-kb"],
  globalContext: null,
  tools: ["Internal:tool:search_web"],
  requiresFileUpload: false,
  skillMode: "dynamic" as const,
  skillIds: [],
  subagentIds: [],
  canvasConfig: {
    enabled: true,
    allowedTypes: ["markdown" as const],
    defaultType: "any" as const,
  },
  approvalConfig: {
    defaultReviewGate: "none" as const,
    toolApprovalMode: "auto" as const,
    autoApprovedTools: [],
  },
};

const baseAgent: Agent = {
  id: "agent-1",
  userId: "user-1",
  name: "SQL Auditor",
  description: "Audits SQL",
  prompt: "You are a strict SQL auditor.",
  subagentPrompt: "",
  modelId: "agent-model",
  reasoningEffort: "high",
  knowledgebaseIds: ["agent-kb"],
  tools: ["srv-1:tool:run_query"],
  skillMode: "specific",
  skillIds: ["agent-skill-1"],
  promptMode: "all",
  promptIds: [],
  subagentIds: ["sub-agent-1"],
  guardrails: {
    maxSteps: 10,
    maxToolCalls: 20,
    allowSubagentDelegation: true,
  },
  avatar: null,
  isBuiltIn: false,
  isOrchestrator: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeAiNode(overrides?: Partial<WorkflowNode["data"]>): WorkflowNode {
  return {
    id: "node-1",
    type: "ai_step",
    name: "Audit Step",
    position: { x: 0, y: 0 },
    data: {
      kind: "ai_step",
      variableName: "auditStep",
      prompt: "Check query",
      mcpServerIds: [],
      toolIds: [],
      requiresReview: false,
      ...overrides,
    } as WorkflowNode["data"],
  };
}

describe("executeSingleWorkflowNode — agent persona & overrides", () => {
  const mockCleanup = vi.fn().mockResolvedValue(undefined);
  const emit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectFromWhere.mockResolvedValue([{ id: "run-1", status: "running" }]);
    mockUpdateReturning.mockResolvedValue([{ id: "run-1" }]);
    mockLoadWorkflowContext.mockResolvedValue({
      allServers: [{ id: "srv-1", name: "PostgresMCP" }],
      resolvedProvider: { modelId: "agent-model", sdkProvider: {} },
      kbContext: "",
      availableSkills: [],
      selectedSkills: [],
      linkedSubagents: [],
      mcpTools: {},
      toolSourceMap: {},
      mcpCleanup: mockCleanup,
    });
    mockExecuteAiStepNode.mockResolvedValue({
      status: "completed",
      summary: "Done",
      artifact: null,
      currentOutputAttachmentIds: [],
      currentAttachmentRows: [],
      activeWorkbookFilePath: null,
      toolCalls: [],
    });
  });

  it("resolves linked agent, passes persona prompt and agent defaults to context and executor", async () => {
    mockResolveLinkedSubagents.mockResolvedValueOnce([baseAgent]);

    const outcome = await executeSingleWorkflowNode({
      runId: "run-1",
      userId: "user-1",
      node: makeAiNode({ agentId: "agent-1" }),
      stepIndex: 0,
      allNodes: [],
      workflowRow: baseWorkflowRow,
      initialData: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit,
    });

    expect(outcome.status).toBe("completed");
    expect(mockResolveLinkedSubagents).toHaveBeenCalledWith("user-1", [
      "agent-1",
    ]);
    expect(mockLoadWorkflowContext).toHaveBeenCalledWith(
      expect.objectContaining({
        modelOverride: "agent-model",
        nodeOverride: {
          reasoningEffort: "high",
          knowledgeBaseIds: ["agent-kb"],
          skillMode: "specific",
          skillIds: ["agent-skill-1"],
          subagentIds: ["sub-agent-1"],
        },
      }),
    );
    expect(mockExecuteAiStepNode).toHaveBeenCalledWith(
      expect.objectContaining({
        agentPersonaPrompt: "You are a strict SQL auditor.",
        effectiveTools: ["srv-1:tool:run_query"],
        data: expect.objectContaining({
          mcpServerIds: ["srv-1"],
          subagentIds: ["sub-agent-1"],
        }),
      }),
    );
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it("lets explicit node overrides win over linked agent defaults", async () => {
    mockResolveLinkedSubagents.mockResolvedValueOnce([baseAgent]);

    const outcome = await executeSingleWorkflowNode({
      runId: "run-1",
      userId: "user-1",
      node: makeAiNode({
        agentId: "agent-1",
        modelId: "node-model",
        reasoningEffort: "medium",
        knowledgeBaseIds: ["node-kb"],
        skillMode: "none",
        toolIds: ["srv-2:tool:custom"],
        mcpServerIds: ["srv-2"],
        subagentIds: ["node-sub-1"],
      }),
      stepIndex: 0,
      allNodes: [],
      workflowRow: baseWorkflowRow,
      initialData: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit,
    });

    expect(outcome.status).toBe("completed");
    expect(mockLoadWorkflowContext).toHaveBeenCalledWith(
      expect.objectContaining({
        modelOverride: "node-model",
        nodeOverride: {
          reasoningEffort: "medium",
          knowledgeBaseIds: ["node-kb"],
          skillMode: "none",
          skillIds: [],
          subagentIds: ["node-sub-1"],
        },
      }),
    );
    expect(mockExecuteAiStepNode).toHaveBeenCalledWith(
      expect.objectContaining({
        agentPersonaPrompt: "You are a strict SQL auditor.",
        effectiveTools: ["srv-2:tool:custom"],
        data: expect.objectContaining({
          mcpServerIds: ["srv-2"],
          subagentIds: ["node-sub-1"],
        }),
      }),
    );
  });

  it("fails node cleanly with descriptive error without invoking LLM when linked agent is deleted", async () => {
    mockResolveLinkedSubagents.mockResolvedValueOnce([]);

    const outcome = await executeSingleWorkflowNode({
      runId: "run-1",
      userId: "user-1",
      node: makeAiNode({ agentId: "deleted-agent-99" }),
      stepIndex: 0,
      allNodes: [],
      workflowRow: baseWorkflowRow,
      initialData: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit,
    });

    expect(outcome).toEqual({ status: "failed" });
    expect(mockLoadWorkflowContext).not.toHaveBeenCalled();
    expect(mockExecuteAiStepNode).not.toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        currentNodeId: "node-1",
        errorMessage: expect.stringContaining("deleted-agent-99"),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        nodeId: "node-1",
        message: expect.stringContaining("deleted-agent-99"),
      }),
    );
  });

  it("executes filter node in deterministic mode and returns filterSummary", async () => {
    mockExecuteFilterNode.mockResolvedValueOnce({
      items: [{ id: 1 }],
      excluded: [{ id: 2 }],
      count: 1,
      totalCount: 2,
      reasoning: "Matched 1 of 2",
      activeHandles: ["main"],
    });

    const filterNode: WorkflowNode = {
      id: "filter-1",
      type: "filter",
      name: "Filter Items",
      position: { x: 0, y: 0 },
      data: {
        kind: "filter",
        variableName: "filtered",
        itemsTemplate: "{{items}}",
        evaluationMode: "deterministic",
        logic: "and",
        rules: [],
        continueWhenEmpty: true,
      },
    };

    const outcome = await executeSingleWorkflowNode({
      runId: "run-1",
      userId: "user-1",
      node: filterNode,
      stepIndex: 0,
      allNodes: [filterNode],
      workflowRow: baseWorkflowRow,
      initialData: {},
      contextData: { items: [{ id: 1 }, { id: 2 }] },
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit,
    });

    expect(outcome.status).toBe("completed");
    if (outcome.status === "completed") {
      expect(outcome.activeHandles).toEqual(["main"]);
      expect(outcome.nodeState.filterSummary).toEqual({
        kept: 1,
        total: 2,
        reasoning: "Matched 1 of 2",
      });
    }
  });

  it("executes filter node in LLM mode with continueWhenEmpty: false", async () => {
    const fakeChatModel = { modelId: "filter-llm" };
    mockResolveProvider.mockResolvedValueOnce({
      modelId: "filter-llm",
      sdkProvider: { chat: () => fakeChatModel },
    });
    mockExecuteFilterNode.mockResolvedValueOnce({
      items: [],
      excluded: [{ id: 1 }],
      count: 0,
      totalCount: 1,
      reasoning: "None matched",
      activeHandles: [],
    });

    const filterNode: WorkflowNode = {
      id: "filter-2",
      type: "filter",
      name: "LLM Filter",
      position: { x: 0, y: 0 },
      data: {
        kind: "filter",
        variableName: "filtered",
        itemsTemplate: "{{items}}",
        evaluationMode: "llm",
        logic: "and",
        rules: [],
        llmFilterPrompt: "Keep valid",
        continueWhenEmpty: false,
      },
    };

    const outcome = await executeSingleWorkflowNode({
      runId: "run-1",
      userId: "user-1",
      node: filterNode,
      stepIndex: 0,
      allNodes: [filterNode],
      workflowRow: baseWorkflowRow,
      initialData: {},
      contextData: { items: [{ id: 1 }] },
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit,
    });

    expect(mockExecuteFilterNode).toHaveBeenCalledWith(
      expect.objectContaining({ model: fakeChatModel }),
    );
    expect(outcome.status).toBe("completed");
    if (outcome.status === "completed") {
      expect(outcome.activeHandles).toEqual([]);
    }
  });

  it("fails cleanly when an unsupported node kind reaches single-node executor", async () => {
    const loopNode: WorkflowNode = {
      id: "loop-1",
      type: "loop",
      name: "Loop",
      position: { x: 0, y: 0 },
      data: {
        kind: "loop",
        variableName: "loop1",
        mode: "count",
        count: 2,
        maxIterations: 20,
      },
    };

    const outcome = await executeSingleWorkflowNode({
      runId: "run-1",
      userId: "user-1",
      node: loopNode,
      stepIndex: 0,
      allNodes: [loopNode],
      workflowRow: baseWorkflowRow,
      initialData: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit,
    });

    expect(outcome).toEqual({ status: "failed" });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        nodeId: "loop-1",
        message: expect.stringContaining('Unsupported node kind "loop"'),
      }),
    );
  });

  it("forwards stepIdPrefix to review and tool approval gates in executeNodeWithGates", async () => {
    let capturedGateId: string | undefined;
    const step = {
      run: vi.fn(async (id: string, fn: () => Promise<unknown>) => {
        const res = await fn();
        if (id.includes("pause-") && typeof res === "string") {
          capturedGateId = res;
        }
        return res;
      }),
      waitForEvent: vi.fn(async () => ({
        data: { nodeId: "node-1", gateId: capturedGateId, approved: true },
      })),
    };

    const res = await executeNodeWithGates({
      step,
      runId: "run-1",
      userId: "user-1",
      node: makeAiNode({ requiresReview: true, reviewTiming: "before" }),
      stepIndex: 0,
      allNodes: [],
      workflowRow: baseWorkflowRow,
      initialData: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      activeArtifact: null,
      dryRun: false,
      nodeStates: {},
      emit,
      stepIdPrefix: "loop-l1-iter-0-",
    });

    expect(res.status).toBe("completed");
    expect(step.run).toHaveBeenCalledWith(
      "loop-l1-iter-0-pause-before-review-node-1",
      expect.any(Function),
    );
    expect(step.waitForEvent).toHaveBeenCalledWith(
      "loop-l1-iter-0-wait-before-review-node-1",
      expect.any(Object),
    );
    expect(step.run).toHaveBeenCalledWith(
      "loop-l1-iter-0-node-node-1",
      expect.any(Function),
    );
    expect(step.run).toHaveBeenCalledWith(
      "loop-l1-iter-0-checkpoint-node-node-1",
      expect.any(Function),
    );
  });
});
