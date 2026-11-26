import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAiStepNode } from "@/lib/workflows/execute-ai-step-node";
import type { AiStepNodeData } from "@/types/workflows/workflow";

const mockGenerateText = vi.fn();
const mockGenerateStructuredObject = vi.fn();
const mockFilterStepTools = vi.fn();
const mockResolveStepCanvasPolicy = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  isStepCount: () => () => false,
}));

vi.mock("@/lib/chat/generate-structured-object", () => ({
  generateStructuredObject: (...args: unknown[]) =>
    mockGenerateStructuredObject(...args),
}));

vi.mock("@/lib/workflows/step-tool-filtering", () => ({
  filterStepTools: (...args: unknown[]) => mockFilterStepTools(...args),
  assertStepModelCapabilities: vi.fn(),
  resolveStepCanvasPolicy: (...args: unknown[]) =>
    mockResolveStepCanvasPolicy(...args),
  resolveStepFileContext: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/lib/workflows/workflow-tool-approval", () => ({
  applyCanvasToolEnforcement: (tools: Record<string, unknown>) => tools,
  resolveWorkflowToolApprovalMap: () => ({}),
  wrapToolsForWorkflowApproval: ({ tools }: { tools: Record<string, unknown> }) =>
    tools,
  executeResumedToolDecisions: vi.fn(),
}));

vi.mock("@/lib/workflows/ai-step-turn-outputs", () => ({
  collectStepTurnOutputs: vi.fn().mockResolvedValue({
    stepArtifact: null,
    stepHasSpreadsheetMutations: false,
    activeWorkbookFilePath: null,
    toolCalls: [{ toolCallId: "tc-1", toolName: "search", state: "result" }],
  }),
  classifyAiStepError: (err: unknown) => ({
    message: err instanceof Error ? err.message : String(err),
    code: "INTERNAL_ERROR",
  }),
}));

vi.mock("@/lib/workflows/step-artifact-output", () => ({
  handleStepArtifactOutput: vi.fn().mockResolvedValue({
    success: true,
    stepArtifact: null,
    stepOutputAttachmentId: undefined,
    currentOutputAttachmentIds: [],
    currentAttachmentRows: [],
    activeWorkbookFilePath: null,
  }),
}));

vi.mock("@/lib/workflows/step-system-prompt", () => ({
  buildStepSystemPrompt: vi.fn().mockReturnValue("system prompt"),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    update: () => ({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

const baseData: AiStepNodeData = {
  label: "Extract",
  variableName: "step1",
  prompt: "Extract invoice data",
  mcpServerIds: [],
  toolIds: [],
  knowledgeBaseIds: [],
  skillMode: "all",
  skillIds: [],
  subagentIds: [],
  canvasMode: "any",
  toolApprovalMode: "workflow_default",
  humanReview: false,
  outputMode: "structured",
  structuredOutputSchema: {
    fields: [
      { id: "f1", name: "total", type: "number", required: true },
      { id: "f2", name: "vendor", type: "string", required: true },
    ],
  },
};

function makeParams(overrides: Partial<Parameters<typeof executeAiStepNode>[0]> = {}) {
  return {
    runId: "run-1",
    nodeId: "node-1",
    nodeName: "Extract",
    stepIndex: 0,
    userId: "user-1",
    data: baseData,
    workflow: {
      globalContext: null,
      tools: [],
      requiresFileUpload: false,
      canvasConfig: { enabled: true, allowedTypes: [], sharedCanvas: true },
      approvalConfig: { mode: "none" as const, tools: [] },
    },
    context: {},
    resolvedProvider: {
      modelId: "gpt-4o",
      sdkProvider: { chat: () => "mock-model" },
    } as any,
    allServers: [],
    runMcpTools: {},
    runToolSourceMap: {},
    kbContext: "",
    skillCatalog: [],
    preloadedSkills: [],
    linkedSubagents: [],
    currentAttachmentRows: [],
    currentOutputAttachmentIds: [],
    activeWorkbookFilePath: null,
    dryRun: false,
    emit: vi.fn(),
    ...overrides,
  };
}

describe("executeAiStepNode (structured output)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveStepCanvasPolicy.mockReturnValue({
      enabled: false,
      enforcedType: null,
      allowedTypes: [],
    });
  });

  it("fails cleanly when outputMode is structured with empty fields", async () => {
    mockFilterStepTools.mockReturnValue({
      filteredTools: {},
      toolSourceMap: {},
      stepServerNames: new Map(),
    });

    const res = await executeAiStepNode(
      makeParams({
        data: {
          ...baseData,
          structuredOutputSchema: { fields: [] },
        },
      }),
    );

    expect(res.status).toBe("failed");
    if (res.status === "failed") {
      expect(res.errorMessage).toContain("at least one output field");
    }
    expect(mockGenerateStructuredObject).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("calls generateStructuredObject directly when no tools are active and disables canvas", async () => {
    mockFilterStepTools.mockReturnValue({
      filteredTools: {},
      toolSourceMap: {},
      stepServerNames: new Map(),
    });
    mockGenerateStructuredObject.mockResolvedValue({
      total: 42,
      vendor: "Acme",
    });

    const res = await executeAiStepNode(makeParams());

    expect(mockFilterStepTools).toHaveBeenCalledWith(
      expect.objectContaining({
        step: expect.objectContaining({ canvasMode: "disabled" }),
      }),
    );
    expect(mockResolveStepCanvasPolicy).toHaveBeenCalledWith(
      "disabled",
      expect.anything(),
    );
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockGenerateStructuredObject).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      status: "completed",
      structuredOutput: { total: 42, vendor: "Acme" },
      artifact: null,
    });
    if (res.status === "completed") {
      expect(JSON.parse(res.summary)).toEqual({ total: 42, vendor: "Acme" });
    }
  });

  it("runs generateText tool loop first then structures via generateStructuredObject when tools are active", async () => {
    mockFilterStepTools.mockReturnValue({
      filteredTools: { search: { execute: vi.fn() } },
      toolSourceMap: { search: "internal" },
      stepServerNames: new Map(),
    });
    mockGenerateText.mockResolvedValue({
      text: "Found invoice from Acme for $42.",
      steps: [],
    });
    mockGenerateStructuredObject.mockResolvedValue({
      total: 42,
      vendor: "Acme",
    });

    const res = await executeAiStepNode(makeParams());

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining("total (number)"),
      }),
    );
    expect(mockGenerateStructuredObject).toHaveBeenCalledTimes(1);
    expect(mockGenerateStructuredObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Found invoice from Acme for $42."),
      }),
    );
    expect(mockGenerateStructuredObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Tool outputs:\n[search]:"),
      }),
    );
    expect(res).toMatchObject({
      status: "completed",
      structuredOutput: { total: 42, vendor: "Acme" },
    });
  });

  it("disables canvas when outputMode is text", async () => {
    mockFilterStepTools.mockReturnValue({
      filteredTools: {},
      toolSourceMap: {},
      stepServerNames: new Map(),
    });
    mockGenerateText.mockResolvedValue({
      text: "Plain text result",
      steps: [],
    });

    const res = await executeAiStepNode(
      makeParams({
        data: {
          ...baseData,
          outputMode: "text",
          canvasMode: "any",
        },
      }),
    );

    expect(mockFilterStepTools).toHaveBeenCalledWith(
      expect.objectContaining({
        step: expect.objectContaining({ canvasMode: "disabled" }),
      }),
    );
    expect(mockResolveStepCanvasPolicy).toHaveBeenCalledWith(
      "disabled",
      expect.anything(),
    );
    expect(res.status).toBe("completed");
  });

  it("handles field descriptions, empty variableName, empty result.text, empty toolCalls, and string tool results", async () => {
    const { collectStepTurnOutputs } = await import(
      "@/lib/workflows/ai-step-turn-outputs"
    );
    mockFilterStepTools.mockReturnValue({
      filteredTools: { search: { execute: vi.fn() } },
      toolSourceMap: { search: "internal" },
      stepServerNames: new Map(),
    });
    mockGenerateText.mockResolvedValueOnce({
      text: "",
      steps: [],
    });
    vi.mocked(collectStepTurnOutputs).mockResolvedValueOnce({
      toolCalls: [],
      stepArtifact: null,
      stepHasSpreadsheetMutations: false,
      activeWorkbookFilePath: null,
    });
    mockGenerateStructuredObject.mockResolvedValueOnce({ total: 1 });

    await executeAiStepNode(
      makeParams({
        data: {
          ...baseData,
          variableName: "",
          structuredOutputSchema: {
            fields: [{ name: "total", type: "number", description: "Total amount" }],
          },
        },
      }),
    );

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining("- total (number): Total amount"),
      }),
    );
    expect(mockGenerateStructuredObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: "step_output",
        prompt: "Extract structured output from the completed task.",
      }),
    );

    mockGenerateText.mockResolvedValueOnce({
      text: "Done",
      steps: [],
    });
    vi.mocked(collectStepTurnOutputs).mockResolvedValueOnce({
      toolCalls: [
        { toolCallId: "tc-1", toolName: "search", state: "result", result: "plain string result" },
      ],
      stepArtifact: null,
      stepHasSpreadsheetMutations: false,
      activeWorkbookFilePath: null,
    });
    mockGenerateStructuredObject.mockResolvedValueOnce({ total: 2 });

    await executeAiStepNode(makeParams());
    expect(mockGenerateStructuredObject).toHaveBeenLastCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("[search]: plain string result"),
      }),
    );
  });
});
