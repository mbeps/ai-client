import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolsNotSupportedError } from "@/lib/error/tools-not-supported-error";
import { VisionNotSupportedError } from "@/lib/error/vision-not-supported-error";
import { executeAiStepNode } from "@/lib/workflows/execute-ai-step-node";
import type { AiStepNodeData, WorkflowCanvasConfig } from "@/types/workflows/workflow";

const mockGenerateText = vi.fn();
const mockHandleStepArtifactOutput = vi.fn();
const mockDbUpdateSetWhere = vi.fn(() =>
  Object.assign(Promise.resolve(undefined), {
    returning: vi.fn().mockResolvedValue([{ id: "run-1" }]),
  }),
);
const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateSetWhere }));
const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  isStepCount: vi.fn(() => ({ type: "stepCount" })),
  tool: (def: unknown) => def,
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock("@/lib/workflows/step-artifact-output", () => ({
  handleStepArtifactOutput: (...args: unknown[]) =>
    mockHandleStepArtifactOutput(...args),
}));

const baseProvider = {
  modelId: "gpt-4o",
  sdkProvider: { chat: (id: string) => ({ modelId: id }) },
  modelRow: { capTools: true, capVision: true, contextWindow: 128000 },
} as any;

const baseNodeData: AiStepNodeData = {
  kind: "ai_step",
  variableName: "step1",
  prompt: "Summarize {{webhook.body.text}}",
  mcpServerIds: [],
  toolIds: [],
  requiresReview: false,
};

const defaultCanvas: WorkflowCanvasConfig = {
  enabled: true,
  allowedTypes: ["markdown", "spreadsheet", "html", "mermaid"],
  defaultType: "any",
};

describe("executeAiStepNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleStepArtifactOutput.mockResolvedValue({
      success: true,
      stepArtifact: null,
      currentOutputAttachmentIds: [],
      currentAttachmentRows: [],
      activeWorkbookFilePath: null,
    });
  });

  it("compiles prompt templates and executes generateText with canvas disabled stripping manage_artifact", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "Done summarizing",
      steps: [],
    });

    const res = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-1",
      nodeName: "Summarize",
      stepIndex: 0,
      userId: "user-1",
      data: { ...baseNodeData, canvasMode: "disabled" },
      workflow: {
        globalContext: "Global ctx",
        tools: ["Internal:tool:manage_artifact"],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: [],
        },
      },
      context: { webhook: { body: { text: "Quarterly numbers" } } },
      resolvedProvider: baseProvider,
      allServers: [{ id: "ops-1", name: "OpsServer" }],
      runMcpTools: {
        manage_artifact: { execute: vi.fn() },
        search_web: { execute: vi.fn() },
      },
      runToolSourceMap: {
        manage_artifact: "Internal",
        search_web: "Internal",
      },
      kbContext: "",
      skillCatalog: [],
      preloadedSkills: [],
      linkedSubagents: [],
      currentAttachmentRows: [],
      currentOutputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit: vi.fn(),
    });

    expect(res.status).toBe("completed");
    expect(res.summary).toBe("Done summarizing");
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.instructions).toContain("Summarize Quarterly numbers");
    expect(callArgs.tools.manage_artifact).toBeUndefined();
  });

  it("enforces specific canvas format when node canvasMode is markdown", async () => {
    const rawManage = vi.fn().mockResolvedValue({
      success: true,
      artifact: { id: "a1", type: "markdown", title: "Report", content: "# Hi" },
    });
    mockGenerateText.mockImplementationOnce(async (opts: any) => {
      const out = await opts.tools.manage_artifact.execute({
        type: "spreadsheet",
        title: "Report",
        content: "# Hi",
      });
      return {
        text: "Created markdown report",
        steps: [
          {
            toolCalls: [{ toolCallId: "tc-1", toolName: "manage_artifact", input: {} }],
            toolResults: [{ toolCallId: "tc-1", toolName: "manage_artifact", result: out }],
          },
        ],
      };
    });

    await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-1",
      nodeName: "Report",
      stepIndex: 0,
      userId: "user-1",
      data: { ...baseNodeData, canvasMode: "markdown" },
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: [],
        },
      },
      context: {},
      resolvedProvider: baseProvider,
      allServers: [{ id: "ops-1", name: "OpsServer" }],
      runMcpTools: {
        manage_artifact: { execute: rawManage, inputSchema: {} },
      },
      runToolSourceMap: { manage_artifact: "Internal" },
      kbContext: "",
      skillCatalog: [],
      preloadedSkills: [],
      linkedSubagents: [],
      currentAttachmentRows: [],
      currentOutputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit: vi.fn(),
    });

    expect(rawManage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "markdown" }),
      undefined,
    );
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.instructions).toContain('type="markdown"');
  });

  it("intercepts gated tools in ask mode and returns awaiting_tool_approval, then executes approved tools on resume", async () => {
    const deleteToolExec = vi.fn().mockResolvedValue({ deleted: true });
    const searchToolExec = vi.fn().mockResolvedValue({ hits: [] });

    mockGenerateText.mockImplementationOnce(async (opts: any) => {
      await opts.tools.dangerous_delete.execute(
        { target: "prod" },
        { toolCallId: "tc-del" },
      );
      return { text: "Paused", steps: [] };
    });

    const firstPass = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-1",
      nodeName: "Cleanup",
      stepIndex: 0,
      userId: "user-1",
      data: { ...baseNodeData, toolApprovalMode: "ask" },
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: ["search_web"],
        },
      },
      context: {},
      resolvedProvider: baseProvider,
      allServers: [{ id: "ops-1", name: "OpsServer" }],
      runMcpTools: {
        dangerous_delete: { execute: deleteToolExec },
        search_web: { execute: searchToolExec },
      },
      runToolSourceMap: {
        dangerous_delete: "OpsServer",
        search_web: "Internal",
      },
      kbContext: "",
      skillCatalog: [],
      preloadedSkills: [],
      linkedSubagents: [],
      currentAttachmentRows: [],
      currentOutputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit: vi.fn(),
    });

    expect(firstPass.status).toBe("awaiting_tool_approval");
    expect(deleteToolExec).not.toHaveBeenCalled();
    if (firstPass.status !== "awaiting_tool_approval") {
      throw new Error("Expected awaiting_tool_approval");
    }
    expect(firstPass.pendingApprovals).toHaveLength(1);
    expect(firstPass.pendingApprovals[0].toolName).toBe("dangerous_delete");

    // Resume with approval
    mockGenerateText.mockResolvedValueOnce({
      text: "Completed after approval",
      steps: [],
    });

    const resumed = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-1",
      nodeName: "Cleanup",
      stepIndex: 0,
      userId: "user-1",
      data: { ...baseNodeData, toolApprovalMode: "ask" },
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: ["search_web"],
        },
      },
      context: {},
      resolvedProvider: baseProvider,
      allServers: [{ id: "ops-1", name: "OpsServer" }],
      runMcpTools: {
        dangerous_delete: { execute: deleteToolExec },
        search_web: { execute: searchToolExec },
      },
      runToolSourceMap: {
        dangerous_delete: "OpsServer",
        search_web: "Internal",
      },
      kbContext: "",
      skillCatalog: [],
      preloadedSkills: [],
      linkedSubagents: [],
      currentAttachmentRows: [],
      currentOutputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit: vi.fn(),
      resumedToolDecisions: [
        {
          approval: firstPass.pendingApprovals[0],
          approved: true,
        },
      ],
    });

    expect(deleteToolExec).toHaveBeenCalledWith({ target: "prod" }, { toolCallId: "tc-del", messages: [] });
    expect(resumed.status).toBe("completed");
  });

  it("handles denied resumed tool decisions without executing tool", async () => {
    const deleteToolExec = vi.fn();
    mockGenerateText.mockResolvedValueOnce({
      text: "Skipped denied tool",
      steps: [],
    });

    const resumed = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-1",
      nodeName: "Cleanup",
      stepIndex: 0,
      userId: "user-1",
      data: { ...baseNodeData, toolApprovalMode: "ask" },
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "ask",
          autoApprovedTools: [],
        },
      },
      context: {},
      resolvedProvider: baseProvider,
      allServers: [{ id: "ops-1", name: "OpsServer" }],
      runMcpTools: { dangerous_delete: { execute: deleteToolExec } },
      runToolSourceMap: { dangerous_delete: "OpsServer" },
      kbContext: "",
      skillCatalog: [],
      preloadedSkills: [],
      linkedSubagents: [],
      currentAttachmentRows: [],
      currentOutputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit: vi.fn(),
      resumedToolDecisions: [
        {
          approval: {
            approvalId: "app-1",
            toolCallId: "tc-1",
            toolName: "dangerous_delete",
            args: {},
            signature: "sig-1",
          },
          approved: false,
        },
      ],
    });

    expect(deleteToolExec).not.toHaveBeenCalled();
    expect(resumed.status).toBe("completed");
  });

  it("fails closed when handleStepArtifactOutput reports unpersisted spreadsheet mutation", async () => {
    mockGenerateText.mockResolvedValueOnce({ text: "Mutated", steps: [] });
    mockHandleStepArtifactOutput.mockResolvedValueOnce({
      success: false,
      stepArtifact: null,
      currentOutputAttachmentIds: [],
      currentAttachmentRows: [],
      activeWorkbookFilePath: null,
    });

    const res = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-1",
      nodeName: "Mutate Sheet",
      stepIndex: 0,
      userId: "user-1",
      data: baseNodeData,
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: [],
        },
      },
      context: {},
      resolvedProvider: baseProvider,
      allServers: [{ id: "ops-1", name: "OpsServer" }],
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
    });

    expect(res.status).toBe("failed");
  });

  it("handles capability errors (ToolsNotSupportedError, VisionNotSupportedError) and emit errors", async () => {
    const emit = vi.fn();
    const resTools = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-1",
      nodeName: "NoTools",
      stepIndex: 0,
      userId: "user-1",
      data: baseNodeData,
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: [],
        },
      },
      context: {},
      resolvedProvider: {
        ...baseProvider,
        modelRow: { capTools: false, capVision: true },
      },
      allServers: [],
      runMcpTools: { search_web: { execute: vi.fn() } },
      runToolSourceMap: { search_web: "Internal" },
      kbContext: "",
      skillCatalog: [],
      preloadedSkills: [],
      linkedSubagents: [],
      currentAttachmentRows: [],
      currentOutputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit,
    });
    expect(resTools.status).toBe("failed");
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", code: "TOOLS_NOT_SUPPORTED" }),
    );

    mockGenerateText.mockRejectedValueOnce(new VisionNotSupportedError());
    const resVision = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-1",
      nodeName: "NoVision",
      stepIndex: 0,
      userId: "user-1",
      data: baseNodeData,
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: [],
        },
      },
      context: {},
      resolvedProvider: baseProvider,
      allServers: [{ id: "ops-1", name: "OpsServer" }],
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
      emit,
    });
    expect(resVision.status).toBe("failed");
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", code: "VISION_NOT_SUPPORTED" }),
    );
    expect(ToolsNotSupportedError).toBeDefined();
  });

  it("handles fallback turn outputs, tool args path, primitive outputs, and empty resumed tools", async () => {
    const emit = vi.fn();
    mockGenerateText.mockImplementationOnce(async (opts: any) => {
      // Trigger wrapped tool without toolCallId option
      await opts.tools.write_cell.execute({ file_path: "/tmp/via-args.xlsx" });
      return {
        text: "",
        steps: [
          {
            toolCalls: [
              { toolCallId: "tc-w", toolName: "write_cell", args: { file_path: "/tmp/via-args.xlsx" } },
              { toolCallId: "tc-art", toolName: "manage_artifact", input: {} },
            ],
            toolResults: [
              { toolCallId: "tc-w", toolName: "write_cell", output: "ok" },
              {
                toolCallId: "tc-art",
                toolName: "manage_artifact",
                output: { type: "markdown", title: "Out", content: "# Doc" },
              },
            ],
          },
        ],
      };
    });

    const res = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-1",
      nodeName: "FallbackTurn",
      stepIndex: 0,
      userId: "user-1",
      data: { ...baseNodeData, toolApprovalMode: "ask" },
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: [],
        },
      },
      context: {},
      resolvedProvider: baseProvider,
      allServers: [],
      runMcpTools: {
        write_cell: { execute: vi.fn() },
        manage_artifact: { execute: vi.fn() },
        non_exec_tool: { description: "no exec" },
      },
      runToolSourceMap: { write_cell: "Internal", manage_artifact: "Internal" },
      kbContext: "",
      skillCatalog: [],
      preloadedSkills: [],
      linkedSubagents: [],
      currentAttachmentRows: [],
      currentOutputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit,
    });
    expect(res.status).toBe("awaiting_tool_approval");

    // Steps undefined + empty text + resumed tool missing from rawTools and undefined args
    mockGenerateText.mockResolvedValueOnce({ text: "", steps: undefined });
    const res2 = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-1",
      nodeName: "MissingToolResume",
      stepIndex: 0,
      userId: "user-1",
      data: baseNodeData,
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: [],
        },
      },
      context: {},
      resolvedProvider: baseProvider,
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
      emit,
      resumedToolDecisions: [
        {
          approval: {
            approvalId: "ap-missing",
            toolCallId: "tc-missing",
            toolName: "gone_tool",
            serverName: "GoneServer",
            args: undefined,
            signature: "sig",
          },
          approved: true,
        },
      ],
    });
    expect(res2.status).toBe("completed");
    if (res2.status === "completed") {
      expect(res2.summary).toBe("Step completed.");
    }
  });

  it("injects activeArtifact into system prompt and preserves artifact id when sharedCanvas is enabled", async () => {
    const existingArtifact = {
      id: "shared-art-1",
      type: "spreadsheet" as const,
      title: "Car Specs",
      content: JSON.stringify({
        sheets: [{ name: "Specs", data: [["Brand", "Model"], ["Lexus", "IS 300h"]] }],
      }),
    };
    const newArtifact = {
      id: "newly-generated-id",
      type: "spreadsheet" as const,
      title: "Car Specs",
      content: JSON.stringify({
        sheets: [
          {
            name: "Specs",
            data: [
              ["Brand", "Model"],
              ["Lexus", "IS 300h"],
              ["BMW", "320d"],
            ],
          },
        ],
      }),
    };

    mockGenerateText.mockResolvedValueOnce({
      text: "Added BMW row",
      steps: [],
    });
    mockHandleStepArtifactOutput.mockResolvedValueOnce({
      success: true,
      stepArtifact: newArtifact,
      currentOutputAttachmentIds: [],
      currentAttachmentRows: [],
      activeWorkbookFilePath: null,
    });

    const res = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-2",
      nodeName: "BMW",
      stepIndex: 1,
      userId: "user-1",
      data: baseNodeData,
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: { ...defaultCanvas, sharedCanvas: true },
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: [],
        },
      },
      context: {},
      resolvedProvider: baseProvider,
      allServers: [],
      runMcpTools: { manage_artifact: { execute: vi.fn() } },
      runToolSourceMap: { manage_artifact: "Internal" },
      kbContext: "",
      skillCatalog: [],
      preloadedSkills: [],
      linkedSubagents: [],
      currentAttachmentRows: [],
      currentOutputAttachmentIds: [],
      activeWorkbookFilePath: null,
      activeArtifact: existingArtifact,
      dryRun: false,
      emit: vi.fn(),
    } as any);

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.instructions).toContain("## Active Shared Canvas");
    expect(callArgs.instructions).toContain("Lexus");
    expect(res.status).toBe("completed");
    if (res.status === "completed") {
      expect(res.artifact?.id).toBe("shared-art-1");
    }
  });

  it("does not inject activeArtifact or preserve id when sharedCanvas is false", async () => {
    const existingArtifact = {
      id: "shared-art-1",
      type: "markdown" as const,
      title: "Draft 1",
      content: "Step 1",
    };
    const newArtifact = {
      id: "fresh-art-2",
      type: "markdown" as const,
      title: "Draft 2",
      content: "Step 2",
    };

    mockGenerateText.mockResolvedValueOnce({
      text: "Done",
      steps: [],
    });
    mockHandleStepArtifactOutput.mockResolvedValueOnce({
      success: true,
      stepArtifact: newArtifact,
      currentOutputAttachmentIds: [],
      currentAttachmentRows: [],
      activeWorkbookFilePath: null,
    });

    const res = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-2",
      nodeName: "Step 2",
      stepIndex: 1,
      userId: "user-1",
      data: baseNodeData,
      workflow: {
        globalContext: null,
        tools: [],
        requiresFileUpload: false,
        canvasConfig: { ...defaultCanvas, sharedCanvas: false },
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: [],
        },
      },
      context: {},
      resolvedProvider: baseProvider,
      allServers: [],
      runMcpTools: { manage_artifact: { execute: vi.fn() } },
      runToolSourceMap: { manage_artifact: "Internal" },
      kbContext: "",
      skillCatalog: [],
      preloadedSkills: [],
      linkedSubagents: [],
      currentAttachmentRows: [],
      currentOutputAttachmentIds: [],
      activeWorkbookFilePath: null,
      activeArtifact: existingArtifact,
      dryRun: false,
      emit: vi.fn(),
    } as any);

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.instructions).not.toContain("## Active Shared Canvas");
    expect(res.status).toBe("completed");
    if (res.status === "completed") {
      expect(res.artifact?.id).toBe("fresh-art-2");
    }
  });

  it("forwards agentPersonaPrompt and effectiveTools to prompt builder and tool filter", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "Audited",
      steps: [],
    });

    const res = await executeAiStepNode({
      runId: "run-1",
      nodeId: "node-3",
      nodeName: "Audit",
      stepIndex: 0,
      userId: "user-1",
      data: { ...baseNodeData, mcpServerIds: ["srv-1"], toolIds: [] },
      workflow: {
        globalContext: null,
        tools: ["Internal:tool:search_web"],
        requiresFileUpload: false,
        canvasConfig: defaultCanvas,
        approvalConfig: {
          defaultReviewGate: "none",
          toolApprovalMode: "auto",
          autoApprovedTools: [],
        },
      },
      context: { webhook: { body: { text: "SELECT 1" } } },
      resolvedProvider: baseProvider,
      allServers: [{ id: "srv-1", name: "PostgresMCP" }],
      runMcpTools: {
        run_query: { execute: vi.fn() },
        search_web: { execute: vi.fn() },
      },
      runToolSourceMap: {
        run_query: "PostgresMCP",
        search_web: "Internal",
      },
      kbContext: "",
      skillCatalog: [],
      preloadedSkills: [],
      linkedSubagents: [],
      currentAttachmentRows: [],
      currentOutputAttachmentIds: [],
      activeWorkbookFilePath: null,
      dryRun: false,
      emit: vi.fn(),
      agentPersonaPrompt: "You are a strict SQL auditor.",
      effectiveTools: ["srv-1:tool:run_query"],
    });

    expect(res.status).toBe("completed");
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.instructions).toContain(
      "Agent Persona:\nYou are a strict SQL auditor.",
    );
    expect(callArgs.tools.run_query).toBeDefined();
    expect(callArgs.tools.search_web).toBeUndefined();
  });
});
