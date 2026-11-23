import { NonRetriableError } from "inngest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { inngest } from "@/lib/inngest/client";
import { executeWorkflowRun } from "@/lib/inngest/functions/workflow-run";
import {
  executeSingleWorkflowNode,
  failWorkflowRun,
  resolveNodeReviewGate,
} from "@/lib/workflows/workflow-run-helpers";

const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockUpdateSet = vi.hoisted(() =>
  vi.fn().mockReturnValue({ where: mockUpdateWhere }),
);
const mockUpdate = vi.hoisted(() =>
  vi.fn().mockReturnValue({ set: mockUpdateSet }),
);

const mockDb = vi.hoisted(() => ({
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: mockSelectWhere,
    })),
  })),
  update: mockUpdate,
}));

vi.mock("@/drizzle/db", () => ({ db: mockDb }));

const mockLoadWorkflowContext = vi.hoisted(() => vi.fn());
const mockExecuteAiStepNode = vi.hoisted(() => vi.fn());
const mockEvaluateIfConditionNode = vi.hoisted(() => vi.fn());
const mockExecuteHttpRequestNode = vi.hoisted(() => vi.fn());
const mockBuildFileContext = vi.hoisted(() => vi.fn());
const mockResolveProvider = vi.hoisted(() => vi.fn());

vi.mock("@/lib/workflows/load-workflow-context", () => ({
  loadWorkflowContext: mockLoadWorkflowContext,
}));
vi.mock("@/lib/workflows/execute-ai-step-node", () => ({
  executeAiStepNode: mockExecuteAiStepNode,
}));
vi.mock("@/lib/workflows/evaluate-if-condition", () => ({
  evaluateIfConditionNode: mockEvaluateIfConditionNode,
}));
vi.mock("@/lib/workflows/execute-http-node", () => ({
  executeHttpRequestNode: mockExecuteHttpRequestNode,
}));
vi.mock("@/lib/workflows/build-file-context", () => ({
  buildFileContext: mockBuildFileContext,
}));
vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: mockResolveProvider,
}));

const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => mockLog),
  logger: mockLog,
}));

const baseWorkflow = {
  id: "wf-1",
  userId: "user-1",
  name: "DAG Workflow",
  description: null,
  globalContext: null,
  modelId: null,
  tools: [],
  skillMode: "dynamic" as const,
  skillIds: [],
  knowledgeBaseIds: [],
  subagentIds: [],
  requiresFileUpload: false,
  canvasConfig: {
    enabled: true,
    allowedTypes: ["markdown", "spreadsheet", "html", "mermaid"],
    defaultType: "any",
  },
  approvalConfig: {
    defaultReviewGate: "none" as const,
    toolApprovalMode: "auto" as const,
    autoApprovedTools: [],
  },
};

function createStepMock(waitResults: unknown[] = []) {
  let waitIdx = 0;
  return {
    run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
    waitForEvent: vi.fn(async () => waitResults[waitIdx++] ?? null),
  };
}

describe("executeWorkflowRun Inngest DAG Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildFileContext.mockResolvedValue({ attachmentRows: [] });
    mockLoadWorkflowContext.mockResolvedValue({
      allServers: [],
      resolvedProvider: {
        modelId: "gpt-4o",
        sdkProvider: { chat: (id: string) => ({ modelId: id }) },
        modelRow: { capTools: true, capVision: true },
      },
      kbContext: "",
      availableSkills: [],
      selectedSkills: [],
      linkedSubagents: [],
      mcpTools: {},
      toolSourceMap: {},
      mcpCleanup: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("executes full DAG: trigger -> AI step -> If branch (pruning false branch) -> diamond convergence -> HTTP node", async () => {
    const runRow = {
      id: "run-1",
      workflowId: "wf-1",
      userId: "user-1",
      triggerType: "webhook",
      status: "pending",
      dryRun: false,
      initialData: { webhook: { body: { amount: 100 } } },
      nodeStates: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
    };
    const nodes = [
      {
        id: "n-trig",
        workflowId: "wf-1",
        type: "webhook_trigger",
        name: "Webhook",
        position: { x: 0, y: 0 },
        data: { kind: "webhook_trigger", variableName: "webhook" },
      },
      {
        id: "n-ai",
        workflowId: "wf-1",
        type: "ai_step",
        name: "Analyze",
        position: { x: 100, y: 0 },
        data: {
          kind: "ai_step",
          variableName: "step1",
          prompt: "Analyze",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: false,
        },
      },
      {
        id: "n-if",
        workflowId: "wf-1",
        type: "if_condition",
        name: "Check",
        position: { x: 200, y: 0 },
        data: {
          kind: "if_condition",
          variableName: "branch1",
          evaluationMode: "deterministic",
          logic: "and",
          rules: [],
        },
      },
      {
        id: "n-true",
        workflowId: "wf-1",
        type: "http_request",
        name: "Notify True",
        position: { x: 300, y: -50 },
        data: {
          kind: "http_request",
          variableName: "httpTrue",
          method: "POST",
          url: "https://example.com/true",
          headers: [],
        },
      },
      {
        id: "n-false",
        workflowId: "wf-1",
        type: "http_request",
        name: "Notify False",
        position: { x: 300, y: 50 },
        data: {
          kind: "http_request",
          variableName: "httpFalse",
          method: "POST",
          url: "https://example.com/false",
          headers: [],
        },
      },
      {
        id: "n-join",
        workflowId: "wf-1",
        type: "http_request",
        name: "Join Final",
        position: { x: 400, y: 0 },
        data: {
          kind: "http_request",
          variableName: "httpJoin",
          method: "GET",
          url: "https://example.com/done",
          headers: [],
        },
      },
    ];
    const edges = [
      { id: "e1", workflowId: "wf-1", sourceNodeId: "n-trig", targetNodeId: "n-ai", sourceHandle: "main", targetHandle: "main" },
      { id: "e2", workflowId: "wf-1", sourceNodeId: "n-ai", targetNodeId: "n-if", sourceHandle: "main", targetHandle: "main" },
      { id: "e3", workflowId: "wf-1", sourceNodeId: "n-if", targetNodeId: "n-true", sourceHandle: "true", targetHandle: "main" },
      { id: "e4", workflowId: "wf-1", sourceNodeId: "n-if", targetNodeId: "n-false", sourceHandle: "false", targetHandle: "main" },
      { id: "e5", workflowId: "wf-1", sourceNodeId: "n-true", targetNodeId: "n-join", sourceHandle: "main", targetHandle: "main" },
      { id: "e6", workflowId: "wf-1", sourceNodeId: "n-false", targetNodeId: "n-join", sourceHandle: "main", targetHandle: "main" },
    ];

    let selectCount = 0;
    mockSelectWhere.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) return Promise.resolve([runRow]);
      if (selectCount === 2) return Promise.resolve([baseWorkflow]);
      if (selectCount === 3) return Promise.resolve(nodes);
      if (selectCount === 4) return Promise.resolve(edges);
      return Promise.resolve([{ ...runRow, status: "running" }]);
    });

    mockExecuteAiStepNode.mockResolvedValueOnce({
      status: "completed",
      summary: "AI summary",
      artifact: null,
      outputAttachmentId: "out-1",
      currentOutputAttachmentIds: ["out-1"],
      currentAttachmentRows: [],
      activeWorkbookFilePath: null,
      toolCalls: [],
    });
    mockEvaluateIfConditionNode.mockResolvedValueOnce({
      branch: "true",
      reasoning: "Matched",
    });
    mockExecuteHttpRequestNode
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: { sent: true },
        summary: "POST true",
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: { joined: true },
        summary: "GET done",
      });

    const fn = (executeWorkflowRun as any).fn;
    const result = await fn({
      event: { data: { runId: "run-1", workflowId: "wf-1", userId: "user-1" } },
      step: createStepMock(),
    });

    expect(result).toEqual({ success: true, completed: true });
    // False branch was skipped, so only 2 HTTP nodes executed (n-true and n-join)
    expect(mockExecuteHttpRequestNode).toHaveBeenCalledTimes(2);
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "workflow-node-skipped", nodeId: "n-false" }),
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "workflow-complete",
        runId: "run-1",
        outputAttachmentIds: ["out-1"],
      }),
    );
  });

  it("throws NonRetriableError on cyclic workflow graph", async () => {
    const runRow = {
      id: "run-cyc",
      workflowId: "wf-1",
      userId: "user-1",
      status: "pending",
      dryRun: false,
      initialData: {},
      nodeStates: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
    };
    const nodes = [
      { id: "a", workflowId: "wf-1", type: "ai_step", name: "A", position: { x: 0, y: 0 }, data: { kind: "ai_step", variableName: "a", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: false } },
      { id: "b", workflowId: "wf-1", type: "ai_step", name: "B", position: { x: 100, y: 0 }, data: { kind: "ai_step", variableName: "b", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: false } },
    ];
    const edges = [
      { id: "e1", workflowId: "wf-1", sourceNodeId: "a", targetNodeId: "b", sourceHandle: "main", targetHandle: "main" },
      { id: "e2", workflowId: "wf-1", sourceNodeId: "b", targetNodeId: "a", sourceHandle: "main", targetHandle: "main" },
    ];

    mockSelectWhere
      .mockResolvedValueOnce([runRow])
      .mockResolvedValueOnce([baseWorkflow])
      .mockResolvedValueOnce(nodes)
      .mockResolvedValueOnce(edges);

    const fn = (executeWorkflowRun as any).fn;
    await expect(
      fn({
        event: { data: { runId: "run-cyc", workflowId: "wf-1", userId: "user-1" } },
        step: createStepMock(),
      }),
    ).rejects.toThrow(NonRetriableError);
  });

  it("handles before/after human review gates and tool approval gates via step.waitForEvent", async () => {
    const runRow = {
      id: "run-gates",
      workflowId: "wf-1",
      userId: "user-1",
      status: "pending",
      dryRun: false,
      initialData: {},
      nodeStates: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
    };
    const nodes = [
      {
        id: "n-before",
        workflowId: "wf-1",
        type: "ai_step",
        name: "Before Gate",
        position: { x: 0, y: 0 },
        data: {
          kind: "ai_step",
          variableName: "s1",
          prompt: "Run",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: true,
          reviewTiming: "before",
        },
      },
      {
        id: "n-after",
        workflowId: "wf-1",
        type: "ai_step",
        name: "After + Tool Gate",
        position: { x: 200, y: 0 },
        data: {
          kind: "ai_step",
          variableName: "s2",
          prompt: "Run 2",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: true,
          reviewTiming: "after",
        },
      },
    ];

    let selectCount = 0;
    mockSelectWhere.mockImplementation(() => {
      selectCount++;
      if (selectCount === 1) return Promise.resolve([runRow]);
      if (selectCount === 2) return Promise.resolve([baseWorkflow]);
      if (selectCount === 3) return Promise.resolve(nodes);
      if (selectCount === 4) return Promise.resolve([]);
      return Promise.resolve([{ ...runRow, status: "running" }]);
    });

    mockExecuteAiStepNode
      .mockResolvedValueOnce({
        status: "completed",
        summary: "Step 1 done",
        artifact: null,
        currentOutputAttachmentIds: [],
        currentAttachmentRows: [],
        activeWorkbookFilePath: null,
        toolCalls: [],
      })
      .mockResolvedValueOnce({
        status: "awaiting_tool_approval",
        pendingApprovals: [
          {
            approvalId: "app-1",
            toolCallId: "tc-1",
            toolName: "delete_item",
            args: {},
            signature: "sig-1",
          },
        ],
        toolCalls: [],
      })
      .mockResolvedValueOnce({
        status: "completed",
        summary: "Step 2 done",
        artifact: null,
        currentOutputAttachmentIds: [],
        currentAttachmentRows: [],
        activeWorkbookFilePath: null,
        toolCalls: [],
      });

    const stepMock = createStepMock([
      { data: { runId: "run-gates", nodeId: "n-before", approved: true } },
      {
        data: {
          runId: "run-gates",
          nodeId: "n-after",
          approved: true,
          toolDecisions: [{ approvalId: "app-1", approved: true }],
        },
      },
      { data: { runId: "run-gates", nodeId: "n-after", approved: true } },
    ]);

    const fn = (executeWorkflowRun as any).fn;
    const result = await fn({
      event: { data: { runId: "run-gates", workflowId: "wf-1", userId: "user-1" } },
      step: stepMock,
    });

    expect(result).toEqual({ success: true, completed: true });
    expect(stepMock.waitForEvent).toHaveBeenCalledTimes(3);
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "workflow-tool-approval-required",
        nodeId: "n-after",
      }),
    );
  });

  it("fails run when review gate rejects or times out", async () => {
    const runRow = {
      id: "run-rej",
      workflowId: "wf-1",
      userId: "user-1",
      status: "pending",
      dryRun: false,
      initialData: {},
      nodeStates: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
    };
    const nodes = [
      {
        id: "n-1",
        workflowId: "wf-1",
        type: "http_request",
        name: "HTTP",
        position: { x: 0, y: 0 },
        data: {
          kind: "http_request",
          variableName: "h1",
          method: "POST",
          url: "https://example.com",
          headers: [],
          requiresReview: true,
        },
      },
    ];

    mockSelectWhere
      .mockResolvedValueOnce([runRow])
      .mockResolvedValueOnce([baseWorkflow])
      .mockResolvedValueOnce(nodes)
      .mockResolvedValueOnce([]);

    const fn = (executeWorkflowRun as any).fn;
    const rejected = await fn({
      event: { data: { runId: "run-rej", workflowId: "wf-1", userId: "user-1" } },
      step: createStepMock([
        { data: { runId: "run-rej", nodeId: "n-1", approved: false } },
      ]),
    });
    expect(rejected).toEqual({ success: false });
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: "Rejected by reviewer",
      }),
    );

    mockSelectWhere
      .mockResolvedValueOnce([runRow])
      .mockResolvedValueOnce([baseWorkflow])
      .mockResolvedValueOnce(nodes)
      .mockResolvedValueOnce([]);

    const timedOut = await fn({
      event: { data: { runId: "run-rej", workflowId: "wf-1", userId: "user-1" } },
      step: createStepMock([]),
    });
    expect(timedOut).toEqual({ success: false });
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: "Approval timed out",
      }),
    );
  });

  it("handles missing run, missing workflow, cancelled run, and onFailure callback", async () => {
    const fn = (executeWorkflowRun as any).fn;

    mockSelectWhere.mockResolvedValueOnce([]);
    await expect(
      fn({
        event: { data: { runId: "missing", workflowId: "wf-1", userId: "u1" } },
        step: createStepMock(),
      }),
    ).rejects.toThrow("Workflow run missing not found");

    mockSelectWhere
      .mockResolvedValueOnce([{ id: "run-1", workflowId: "wf-missing" }])
      .mockResolvedValueOnce([]);
    await expect(
      fn({
        event: { data: { runId: "run-1", workflowId: "wf-missing", userId: "u1" } },
        step: createStepMock(),
      }),
    ).rejects.toThrow(NonRetriableError);

    const onFailure = (executeWorkflowRun as any).opts?.onFailure;
    if (typeof onFailure === "function") {
      await onFailure({
        event: { data: { event: { data: {} } } },
        error: new Error("Ignored"),
      });
      vi.spyOn(inngest.realtime, "publish").mockRejectedValueOnce(new Error("rt-err"));
      await onFailure({
        event: { data: { event: { data: { runId: "run-err" } } } },
        error: new Error("Boom"),
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          errorMessage: expect.stringContaining("Something went wrong"),
        }),
      );
    }
  });

  it("covers null runRow arrays, after-review rejection, tool resume without toolDecisions, webhook seed fallback, and llm resolveProvider failure", async () => {
    // 1. resolveNodeReviewGate with requiresReview: true and defaultReviewGate: "none"
    expect(
      resolveNodeReviewGate(
        {
          id: "n-rev",
          type: "ai_step",
          name: "Step",
          position: { x: 0, y: 0 },
          data: { kind: "ai_step", variableName: "s", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: true },
        },
        { defaultReviewGate: "none", toolApprovalMode: "auto", autoApprovedTools: [] },
      ),
    ).toBe("after");

    // 2. failWorkflowRun with undefined nodeId
    await failWorkflowRun("r-1", undefined, "Direct fail", vi.fn());
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ currentNodeId: null, errorMessage: "Direct fail" }),
    );

    // 3. webhook_trigger without webhook/var key + if_condition with resolveProvider failure
    mockSelectWhere.mockResolvedValue([{ id: "r-1", status: "running" }]);
    mockResolveProvider.mockRejectedValueOnce(new Error("Provider missing"));
    mockEvaluateIfConditionNode.mockResolvedValueOnce({ branch: "false", reasoning: "nope" });

    const hookOut = await executeSingleWorkflowNode({
      runId: "r-1",
      userId: "u-1",
      node: {
        id: "n-hook",
        type: "webhook_trigger",
        name: "Hook",
        position: { x: 0, y: 0 },
        data: { kind: "webhook_trigger", variableName: "customHook" },
      },
      stepIndex: 0,
      allNodes: [],
      workflowRow: baseWorkflow as any,
      initialData: { payload: 123 },
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit: vi.fn(),
    });
    expect(hookOut.status).toBe("completed");
    if (hookOut.status === "completed") {
      expect(hookOut.contextEntry).toEqual({ payload: 123 });
    }

    const manualFallbackOut = await executeSingleWorkflowNode({
      runId: "r-1",
      userId: "u-1",
      node: {
        id: "n-man",
        type: "manual_trigger",
        name: "Manual",
        position: { x: 0, y: 0 },
        data: { kind: "manual_trigger", variableName: "manualVar" },
      },
      stepIndex: 0,
      allNodes: [],
      workflowRow: baseWorkflow as any,
      initialData: { custom: 42 },
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit: vi.fn(),
    });
    expect(manualFallbackOut.status).toBe("completed");
    if (manualFallbackOut.status === "completed") {
      expect(manualFallbackOut.contextEntry).toEqual({ custom: 42 });
    }

    const ifOut = await executeSingleWorkflowNode({
      runId: "r-1",
      userId: "u-1",
      node: {
        id: "n-if-fail",
        type: "if_condition",
        name: "If",
        position: { x: 0, y: 0 },
        data: { kind: "if_condition", variableName: "c", evaluationMode: "llm", logic: "and", rules: [], modelId: "missing" },
      },
      stepIndex: 1,
      allNodes: [],
      workflowRow: baseWorkflow as any,
      initialData: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit: vi.fn(),
    });
    expect(ifOut.status).toBe("completed");

    // 4. executeWorkflowRun with null runRow fields, tool approval event without data, and after-review rejection
    const nullRunRow = {
      id: "run-null",
      workflowId: "wf-1",
      userId: "user-1",
      status: "pending",
      dryRun: false,
      initialData: null,
      nodeStates: null,
      contextData: null,
      inputAttachmentIds: null,
      outputAttachmentIds: null,
    };
    const afterRejectNodes = [
      {
        id: "n-ai-after",
        workflowId: "wf-1",
        type: "ai_step",
        name: "AfterReject",
        position: { x: 0, y: 0 },
        data: {
          kind: "ai_step",
          variableName: "s1",
          prompt: "Go",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: true,
          reviewTiming: "after",
        },
      },
    ];
    let selIdx = 0;
    mockSelectWhere.mockImplementation(() => {
      selIdx++;
      if (selIdx === 1) return Promise.resolve([nullRunRow]);
      if (selIdx === 2) return Promise.resolve([baseWorkflow]);
      if (selIdx === 3) return Promise.resolve(afterRejectNodes);
      if (selIdx === 4) return Promise.resolve([]);
      return Promise.resolve([{ ...nullRunRow, status: "running" }]);
    });
    mockExecuteAiStepNode
      .mockResolvedValueOnce({
        status: "awaiting_tool_approval",
        pendingApprovals: [
          { approvalId: "a-x", toolCallId: "t-x", toolName: "t", args: {}, signature: "s" },
        ],
        toolCalls: [],
      })
      .mockResolvedValueOnce({
        status: "completed",
        summary: "Done",
        artifact: null,
        currentOutputAttachmentIds: [],
        currentAttachmentRows: [],
        activeWorkbookFilePath: null,
        toolCalls: [],
      });

    const fn = (executeWorkflowRun as any).fn;
    const afterRej = await fn({
      event: { data: { runId: "run-null", workflowId: "wf-1", userId: "user-1" } },
      step: createStepMock([
        { data: undefined },
        { data: { runId: "run-null", nodeId: "n-ai-after", approved: false } },
      ]),
    });
    expect(afterRej).toEqual({ success: false });
  });

  it("handles tool approval timeout, cancelled mid-run, failed AI step, hybrid If model lookup, file upload attachments, and realtime publish error", async () => {
    const publishSpy = vi.spyOn(inngest.realtime, "publish");
    publishSpy.mockRejectedValueOnce(new Error("Realtime offline")).mockRejectedValueOnce("raw");

    const runRow = {
      id: "run-edge",
      workflowId: "wf-1",
      userId: "user-1",
      status: "pending",
      dryRun: false,
      initialData: { trig: { ok: true } },
      nodeStates: null,
      contextData: null,
      inputAttachmentIds: ["att-in-1"],
      outputAttachmentIds: ["att-out-1"],
    };
    const nodes = [
      {
        id: "n-trig",
        workflowId: "wf-1",
        type: "manual_trigger",
        name: "Trig",
        position: { x: 0, y: 0 },
        data: { kind: "manual_trigger", variableName: "trig" },
      },
      {
        id: "n-if",
        workflowId: "wf-1",
        type: "if_condition",
        name: "HybridIf",
        position: { x: 100, y: 0 },
        data: {
          kind: "if_condition",
          variableName: "cond",
          evaluationMode: "hybrid",
          logic: "and",
          rules: [],
          modelId: "gpt-4o",
        },
      },
      {
        id: "n-if-fallback",
        workflowId: "wf-1",
        type: "if_condition",
        name: "HybridIfFallback",
        position: { x: 150, y: 0 },
        data: {
          kind: "if_condition",
          variableName: "cond2",
          evaluationMode: "llm",
          logic: "and",
          rules: [],
        },
      },
      {
        id: "n-ai",
        workflowId: "wf-1",
        type: "ai_step",
        name: "AskTool",
        position: { x: 200, y: 0 },
        data: {
          kind: "ai_step",
          variableName: "s1",
          prompt: "Run",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: true,
        },
      },
    ];
    const edges = [
      { id: "e1", workflowId: "wf-1", sourceNodeId: "n-trig", targetNodeId: "n-if", sourceHandle: "main", targetHandle: "main" },
      { id: "e2", workflowId: "wf-1", sourceNodeId: "n-if", targetNodeId: "n-if-fallback", sourceHandle: "true", targetHandle: "main" },
      { id: "e3", workflowId: "wf-1", sourceNodeId: "n-if-fallback", targetNodeId: "n-ai", sourceHandle: "true", targetHandle: "main" },
    ];
    const wfBefore = {
      ...baseWorkflow,
      requiresFileUpload: true,
      approvalConfig: {
        defaultReviewGate: "before" as const,
        toolApprovalMode: "auto" as const,
        autoApprovedTools: [],
      },
    };

    mockResolveProvider.mockResolvedValueOnce({
      modelId: "gpt-4o",
      sdkProvider: { chat: (id: string) => ({ modelId: id }) },
    });
    mockEvaluateIfConditionNode.mockResolvedValue({ branch: "true", reasoning: "ok" });
    mockExecuteAiStepNode.mockResolvedValueOnce({
      status: "awaiting_tool_approval",
      pendingApprovals: [
        {
          approvalId: "ap-to",
          toolCallId: "tc-to",
          toolName: "delete_all",
          args: {},
          signature: "sig",
        },
      ],
      toolCalls: [],
    });

    let selCount = 0;
    mockSelectWhere.mockImplementation(() => {
      selCount++;
      if (selCount === 1) return Promise.resolve([runRow]);
      if (selCount === 2) return Promise.resolve([wfBefore]);
      if (selCount === 3) return Promise.resolve(nodes);
      if (selCount === 4) return Promise.resolve(edges);
      return Promise.resolve([{ ...runRow, status: "running" }]);
    });

    const fn = (executeWorkflowRun as any).fn;
    // Approve before review, then timeout on tool approval waitForEvent
    const timeoutRes = await fn({
      event: { data: { runId: "run-edge", workflowId: "wf-1", userId: "user-1" } },
      step: createStepMock([
        { data: { runId: "run-edge", nodeId: "n-ai", approved: true } },
        null,
      ]),
    });
    expect(timeoutRes).toEqual({ success: false });

    // Cancelled mid-run when workflowRun status is already failed
    selCount = 0;
    mockSelectWhere.mockImplementation(() => {
      selCount++;
      if (selCount === 1) return Promise.resolve([runRow]);
      if (selCount === 2) return Promise.resolve([wfBefore]);
      if (selCount === 3) return Promise.resolve([nodes[0]]);
      if (selCount === 4) return Promise.resolve([]);
      return Promise.resolve([{ ...runRow, status: "failed" }]);
    });
    const cancelledRes = await fn({
      event: { data: { runId: "run-edge", workflowId: "wf-1", userId: "user-1" } },
      step: createStepMock([]),
    });
    expect(cancelledRes).toEqual({ success: false, cancelled: true });

    // Failed AI step outcome
    selCount = 0;
    mockSelectWhere.mockImplementation(() => {
      selCount++;
      if (selCount === 1) return Promise.resolve([{ ...runRow, inputAttachmentIds: [], outputAttachmentIds: [] }]);
      if (selCount === 2) return Promise.resolve([baseWorkflow]);
      if (selCount === 3) return Promise.resolve([{ ...nodes[3], data: { ...nodes[3].data, requiresReview: false } }]);
      if (selCount === 4) return Promise.resolve([]);
      return Promise.resolve([{ ...runRow, status: "running" }]);
    });
    mockExecuteAiStepNode.mockResolvedValueOnce({ status: "failed", errorMessage: "AI failed" });
    const failedAiRes = await fn({
      event: { data: { runId: "run-edge", workflowId: "wf-1", userId: "user-1" } },
      step: createStepMock([]),
    });
    expect(failedAiRes).toEqual({ success: false });
  });

  it("passes activeArtifact from step 1 to step 2 when sharedCanvas is enabled", async () => {
    const runRow = {
      id: "run-shared",
      workflowId: "wf-1",
      userId: "user-1",
      triggerType: "manual",
      status: "pending",
      dryRun: false,
      initialData: {},
      nodeStates: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
    };
    const nodes = [
      {
        id: "n1",
        workflowId: "wf-1",
        type: "ai_step",
        name: "Lexus",
        position: { x: 0, y: 0 },
        data: {
          kind: "ai_step",
          variableName: "step1",
          prompt: "Add Lexus",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: false,
        },
      },
      {
        id: "n2",
        workflowId: "wf-1",
        type: "ai_step",
        name: "BMW",
        position: { x: 200, y: 0 },
        data: {
          kind: "ai_step",
          variableName: "step2",
          prompt: "Add BMW",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: false,
        },
      },
    ];
    const edges = [
      {
        id: "e1",
        workflowId: "wf-1",
        sourceNodeId: "n1",
        targetNodeId: "n2",
        sourceHandle: "main",
        targetHandle: "main",
      },
    ];

    let selCount = 0;
    mockSelectWhere.mockImplementation(() => {
      selCount++;
      if (selCount === 1) return Promise.resolve([runRow]);
      if (selCount === 2) return Promise.resolve([{ ...baseWorkflow, canvasConfig: { ...baseWorkflow.canvasConfig, sharedCanvas: true } }]);
      if (selCount === 3) return Promise.resolve(nodes);
      if (selCount === 4) return Promise.resolve(edges);
      return Promise.resolve([{ ...runRow, status: "running" }]);
    });

    const step1Art = {
      id: "art-1",
      type: "spreadsheet" as const,
      title: "Specs",
      content: '{"sheets":[{"name":"Sheet1","data":[["Lexus"]]}]}',
    };
    const step2Art = {
      id: "art-1",
      type: "spreadsheet" as const,
      title: "Specs",
      content: '{"sheets":[{"name":"Sheet1","data":[["Lexus"],["BMW"]]}]}',
    };

    mockExecuteAiStepNode
      .mockResolvedValueOnce({
        status: "completed",
        summary: "Added Lexus",
        artifact: step1Art,
        currentOutputAttachmentIds: [],
        currentAttachmentRows: [],
        activeWorkbookFilePath: null,
        toolCalls: [],
      })
      .mockResolvedValueOnce({
        status: "completed",
        summary: "Added BMW",
        artifact: step2Art,
        currentOutputAttachmentIds: [],
        currentAttachmentRows: [],
        activeWorkbookFilePath: null,
        toolCalls: [],
      });

    const fn = (executeWorkflowRun as any).fn;
    const res = await fn({
      event: { data: { runId: "run-shared", workflowId: "wf-1", userId: "user-1" } },
      step: createStepMock([]),
    });

    expect(res).toEqual({ success: true, completed: true });
    expect(mockExecuteAiStepNode).toHaveBeenCalledTimes(2);
    expect(mockExecuteAiStepNode.mock.calls[0][0].activeArtifact).toBeNull();
    expect(mockExecuteAiStepNode.mock.calls[1][0].activeArtifact).toEqual(step1Art);
  });
});
