import { describe, expect, it, vi } from "vitest";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { buildStepSystemPrompt } from "@/lib/workflows/step-system-prompt";
import {
  assertStepModelCapabilities,
  filterStepTools,
  resolveStepCanvasPolicy,
  resolveStepFileContext,
} from "@/lib/workflows/step-tool-filtering";

const mockResolveProvider = vi.hoisted(() => vi.fn());
const mockCreateSubagentDispatchTool = vi.hoisted(() =>
  vi.fn((opts: any) => ({ execute: vi.fn(), __opts: opts })),
);
vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: (...args: unknown[]) => mockResolveProvider(...args),
}));
vi.mock("@/lib/subagents/create-subagent-dispatch-tool", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/subagents/create-subagent-dispatch-tool")>();
  return {
    ...actual,
    createSubagentDispatchTool: (opts: any) => mockCreateSubagentDispatchTool(opts),
  };
});
vi.mock("@/lib/app-tools/register-manage-skill-tool", () => ({
  registerManageSkillTool: vi.fn((_uid: string, opts?: { deferLoading?: boolean }) => ({
    manage_skill: { execute: vi.fn(), deferLoading: opts?.deferLoading ?? true },
  })),
}));
vi.mock("@/lib/skills/register-skill-tool", () => ({
  registerSkillTool: vi.fn(() => ({ activate_skill: { execute: vi.fn() } })),
}));
vi.mock("@/lib/chat/register-knowledgebase-tool", () => ({
  registerKnowledgebaseTool: vi.fn(() => ({ search_knowledge_base: { execute: vi.fn() } })),
}));

vi.mock("@/lib/workflows/build-file-context", () => ({
  buildFileContext: vi.fn().mockResolvedValue({
    fileContext: "Loaded file ctx",
    attachmentRows: [],
  }),
}));

describe("step-tool-filtering", () => {
  it("filters tools by server and toolIds, prunes upload_file when workbook active, and enforces dryRun", async () => {
    mockResolveProvider.mockResolvedValueOnce({
      modelId: "sub-model",
      sdkProvider: { chat: (id: string) => ({ modelId: id }) },
    });
    const { filteredTools, toolSourceMap } = filterStepTools({
      step: {
        kind: "ai_step",
        variableName: "s1",
        prompt: "Do it",
        mcpServerIds: ["srv-1"],
        toolIds: [
          "srv-1:tool:read_sheet",
          "srv-1:tool:write_cell",
          "srv-1:tool:upload_file",
          INTERNAL_TOOL_IDS.MANAGE_SKILL,
          INTERNAL_TOOL_IDS.DELEGATE_TASK,
        ],
        requiresReview: false,
      },
      workflowRow: {
        tools: ["Internal:tool:manage_artifact"],
        requiresFileUpload: true,
        canvasConfig: { enabled: true, allowedTypes: ["markdown"] },
      },
      allServers: [{ id: "srv-1", name: "ExcelMCP" }],
      runMcpTools: {
        read_sheet: { execute: vi.fn() },
        write_cell: { execute: vi.fn() },
        upload_file: { execute: vi.fn() },
        manage_artifact: { execute: vi.fn() },
        other_srv_tool: { execute: vi.fn() },
        search_knowledge_base: { execute: vi.fn() },
      },
      runToolSourceMap: {
        read_sheet: "ExcelMCP",
        write_cell: "ExcelMCP",
        upload_file: "ExcelMCP",
        manage_artifact: "Internal",
        other_srv_tool: "ForeignMCP",
        search_knowledge_base: "System",
      },
      userId: "u1",
      skillCatalog: [{ id: "sk-1", name: "skill-1", description: "desc" } as any],
      activeWorkbookFilePath: "/tmp/wb.xlsx",
      currentAttachmentRows: [{ id: "a1", name: "wb.xlsx", mimeType: "text/csv" } as any],
      dryRun: true,
      linkedSubagents: [
        {
          id: "sub-1",
          name: "Sub 1",
          description: "Helper",
          prompt: "Help",
          tools: [],
          knowledgebaseIds: ["kb-1"],
        } as any,
      ],
      resolvedProvider: {
        modelId: "gpt-4o",
        sdkProvider: { chat: (id: string) => ({ modelId: id }) },
        modelRow: { contextWindow: 128000 },
      } as any,
    });

    expect(filteredTools.read_sheet).toBeDefined();
    expect(filteredTools.write_cell).toBeUndefined();
    expect(filteredTools.upload_file).toBeUndefined();
    expect(filteredTools.other_srv_tool).toBeUndefined();
    expect(filteredTools.search_knowledge_base).toBeDefined();
    expect(filteredTools.delegate_task).toBeDefined();
    expect(toolSourceMap.read_sheet).toBe("ExcelMCP");

    // Exercise delegate_task factory callbacks
    const subOpts = (filteredTools.delegate_task as any).__opts;
    expect(await subOpts.resolveModelById("m1")).toEqual({ modelId: "sub-model" });
    mockResolveProvider.mockRejectedValueOnce(new Error("no model"));
    expect(await subOpts.resolveModelById("m-missing")).toBeUndefined();
    const isolated = subOpts.buildIsolatedTools({
      tools: [],
      knowledgebaseIds: ["kb-1"],
    });
    expect(isolated.write_cell).toBeUndefined();
    expect(isolated.search_knowledge_base).toBeUndefined();
    const kbTools = subOpts.buildKnowledgebaseTools(["kb-1"]);
    expect(kbTools.search_knowledge_base).toBeDefined();

    // Exercise delegate_task factory callbacks and remaining canvas policy / prompt branches
    const policyFallback = resolveStepCanvasPolicy(undefined, {
      enabled: true,
      allowedTypes: [],
      defaultType: "html",
    });
    expect(policyFallback.enforcedType).toBe("html");

    const disabledPolicy = resolveStepCanvasPolicy(undefined, {
      enabled: false,
      allowedTypes: ["markdown"],
    });
    expect(disabledPolicy.enabled).toBe(false);

    const prompt = buildStepSystemPrompt({
      compiledPrompt: "Run",
      nodeData: {
        kind: "ai_step",
        variableName: "s1",
        prompt: "Run",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
      workflowRow: {
        globalContext: null,
        canvasConfig: { enabled: true, allowedTypes: ["markdown"], defaultType: "any" },
      },
      filteredTools,
      skillCatalog: [{ id: "sk-1", name: "sk", description: "d" } as any],
      preloadedSkills: [{ id: "sk-2", name: "sk2", displayName: "SK2", description: "d", content: "body", files: [] } as any],
      kbContext: "KB data",
      fileContext: "File data",
      dryRun: true,
      linkedSubagents: [{ id: "sub-1", name: "Sub 1", description: "Helper" } as any],
    });
    expect(prompt).toContain("DRY RUN");
    expect(prompt).toContain("KB data");
    expect(prompt).toContain("SK2");

    const untitledSharedPrompt = buildStepSystemPrompt({
      compiledPrompt: "Edit",
      nodeData: {
        kind: "ai_step",
        variableName: "s1",
        prompt: "Edit",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
      workflowRow: {
        globalContext: null,
        canvasConfig: { enabled: true, allowedTypes: ["markdown"], sharedCanvas: true },
      },
      filteredTools,
      skillCatalog: [],
      preloadedSkills: [],
      kbContext: "",
      fileContext: "",
      dryRun: false,
      activeArtifact: { id: "a1", type: "markdown", title: "", content: "hello" },
    });
    expect(untitledSharedPrompt).toContain('"Untitled Artifact"');
  });

  it("throws VisionNotSupportedError when image attachments exist on non-vision model", () => {
    expect(() =>
      assertStepModelCapabilities(
        {
          modelId: "text-only",
          sdkProvider: {} as any,
          modelRow: { capTools: true, capVision: false } as any,
        },
        {},
        [{ id: "img-1", name: "pic.png", mimeType: "image/png" } as any],
      ),
    ).toThrow(/vision/i);

    expect(() =>
      assertStepModelCapabilities(
        { modelId: "default-caps", sdkProvider: {} as any, modelRow: null as any },
        {},
        [{ id: "txt-1", name: "notes.txt", mimeType: "text/plain" } as any],
      ),
    ).not.toThrow();

    expect(() =>
      assertStepModelCapabilities(
        {
          modelId: "vision-ok",
          sdkProvider: {} as any,
          modelRow: { capTools: true, capVision: true } as any,
        },
        {},
        [
          { id: "img-1", name: "pic.png", mimeType: "image/png" } as any,
          { id: "txt-2", name: "data.csv", mimeType: "text/csv" } as any,
        ],
      ),
    ).not.toThrow();

    // Undefined workflow tools / step toolIds
    const fallbackTools = filterStepTools({
      step: {
        kind: "ai_step",
        variableName: "s2",
        prompt: "Go",
        mcpServerIds: [],
        toolIds: undefined as any,
        requiresReview: false,
      },
      workflowRow: {
        tools: undefined as any,
        requiresFileUpload: false,
        canvasConfig: { enabled: true, allowedTypes: ["markdown"] },
      },
      allServers: [],
      runMcpTools: { delegate_check: { execute: vi.fn() } },
      runToolSourceMap: { delegate_check: "Internal" },
      userId: "u1",
      skillCatalog: [],
      activeWorkbookFilePath: null,
      currentAttachmentRows: [],
      dryRun: false,
    });
    expect(fallbackTools.filteredTools.delegate_check).toBeDefined();

    // Missing modelRow contextWindow in subagent buildKnowledgebaseTools
    const subNoCtx = filterStepTools({
      step: {
        kind: "ai_step",
        variableName: "s3",
        prompt: "Go",
        mcpServerIds: [],
        toolIds: [INTERNAL_TOOL_IDS.DELEGATE_TASK],
        requiresReview: false,
      },
      workflowRow: {
        tools: [],
        requiresFileUpload: false,
        canvasConfig: { enabled: true, allowedTypes: ["markdown"] },
      },
      allServers: [],
      runMcpTools: {},
      runToolSourceMap: {},
      userId: "u1",
      skillCatalog: [],
      activeWorkbookFilePath: null,
      currentAttachmentRows: [],
      dryRun: false,
      linkedSubagents: [
        { id: "sub-2", name: "Sub2", description: "D", prompt: "P", tools: [], knowledgebaseIds: ["kb-2"] } as any,
      ],
      resolvedProvider: {
        modelId: "gpt-4o",
        sdkProvider: { chat: (id: string) => ({ modelId: id }) },
        modelRow: {},
      } as any,
    });
    const kbNoCtx = (subNoCtx.filteredTools.delegate_task as any).__opts.buildKnowledgebaseTools(["kb-2"]);
    expect(kbNoCtx.search_knowledge_base).toBeDefined();
  });

  it("resolves step file context for active workbook or attachments", async () => {
    expect(await resolveStepFileContext("/tmp/wb.xlsx", [], "u1")).toContain(
      "/tmp/wb.xlsx",
    );
    expect(
      await resolveStepFileContext(null, [{ id: "a1" } as any], "u1"),
    ).toBe("Loaded file ctx");
    expect(await resolveStepFileContext(null, [], "u1")).toBe("");
  });

  it("registers delegate_task when step.subagentIds is configured even without explicit DELEGATE_TASK toolId", () => {
    const res = filterStepTools({
      step: {
        kind: "ai_step",
        variableName: "s4",
        prompt: "Delegate",
        mcpServerIds: [],
        toolIds: [],
        subagentIds: ["sub-1"],
        requiresReview: false,
      },
      workflowRow: {
        tools: [],
        requiresFileUpload: false,
        canvasConfig: { enabled: false, allowedTypes: [] },
      },
      allServers: [],
      runMcpTools: {},
      runToolSourceMap: {},
      userId: "u1",
      skillCatalog: [],
      activeWorkbookFilePath: null,
      currentAttachmentRows: [],
      dryRun: false,
      linkedSubagents: [
        {
          id: "sub-1",
          name: "Sub1",
          description: "D",
          prompt: "P",
          tools: [],
          knowledgebaseIds: [],
        } as any,
      ],
      resolvedProvider: {
        modelId: "gpt-4o",
        sdkProvider: { chat: (id: string) => ({ modelId: id }) },
        modelRow: {},
      } as any,
    });
    expect(res.filteredTools.delegate_task).toBeDefined();
  });

  it("ignores defaultType in resolveStepCanvasPolicy when not included in allowedTypes", () => {
    const policy = resolveStepCanvasPolicy(undefined, {
      enabled: true,
      allowedTypes: ["markdown"],
      defaultType: "spreadsheet",
    });
    expect(policy.allowedTypes).toEqual(["markdown"]);
    expect(policy.enforcedType).toBeNull();

    const matchedPolicy = resolveStepCanvasPolicy(undefined, {
      enabled: true,
      allowedTypes: ["markdown", "spreadsheet"],
      defaultType: "spreadsheet",
    });
    expect(matchedPolicy.allowedTypes).toEqual(["markdown", "spreadsheet"]);
    expect(matchedPolicy.enforcedType).toBe("spreadsheet");
  });
});
