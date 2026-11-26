import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRegisterKnowledgebaseTool = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/register-knowledgebase-tool", () => ({
  registerKnowledgebaseTool: mockRegisterKnowledgebaseTool,
}));

vi.mock("@/lib/chat/register-artifact-tool", () => ({
  registerArtifactTool: vi.fn(() => ({})),
}));

vi.mock("@/lib/chat/register-file-url-tool", () => ({
  registerFileUrlTool: vi.fn(() => ({})),
}));

const mockCreateSubagentDispatchTool = vi.hoisted(() => vi.fn(() => ({})));
const mockFilterToolsForAgent = vi.hoisted(() =>
  vi.fn((pool: Record<string, any>) => pool),
);
const mockResolveProvider = vi.hoisted(() => vi.fn());
const mockRegisterMemoryTool = vi.hoisted(() => vi.fn(() => ({})));
const mockRegisterSkillTool = vi.hoisted(() => vi.fn(() => ({})));
const mockRegisterAppTools = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: mockResolveProvider,
}));

vi.mock("@/lib/chat/register-memory-tool", () => ({
  registerMemoryTool: mockRegisterMemoryTool,
}));

vi.mock("@/lib/chat/register-skill-tool", () => ({
  registerSkillTool: mockRegisterSkillTool,
}));

vi.mock("@/lib/app-tools/register-app-tools", () => ({
  registerAppTools: mockRegisterAppTools,
}));

vi.mock("@/lib/subagents/create-subagent-dispatch-tool", () => ({
  createSubagentDispatchTool: mockCreateSubagentDispatchTool,
  filterToolsForAgent: mockFilterToolsForAgent,
}));

vi.mock("@/lib/subagents/register-subagent-tools", () => ({
  registerScratchpadTools: vi.fn(() => ({})),
}));

import { buildOrchestratorToolSet } from "@/lib/inngest/chat-response/tool-set-builder";
import { registerScratchpadTools } from "@/lib/subagents/register-subagent-tools";

describe("buildOrchestratorToolSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegisterKnowledgebaseTool.mockReturnValue({});
  });

  const baseParams = {
    userId: "user-1",
    chatId: "chat-1",
    assistantMessageId: "msg-1",
    isToolCallingModel: true,
    mcpTools: {},
    selectedTools: undefined,
    ctx: {
      activeKbIds: ["kb-1"],
      kbIsReady: true,
      availableSkills: [],
    },
    fileAttachments: [],
    isMemoryEnabled: false,
    subagentsEnabled: false,
    resolved: {
      sdkProvider: {
        chat: vi.fn((id: string) => ({ modelId: id })),
      },
      contextWindow: 16_384,
    },
    resolvedModelId: "main-model-id",
    workerResolved: undefined,
  };

  it("returns empty set when model is not tool-calling", () => {
    const result = buildOrchestratorToolSet({
      ...baseParams,
      isToolCallingModel: false,
    });

    expect(result.hasAnyTools).toBe(false);
    expect(result.hasKbTool).toBe(false);
    expect(mockRegisterKnowledgebaseTool).not.toHaveBeenCalled();
  });

  it("configures KB subagent with default resolved model when workerResolved is omitted", () => {
    buildOrchestratorToolSet({
      ...baseParams,
      workerResolved: undefined,
    });

    expect(baseParams.resolved.sdkProvider.chat).toHaveBeenCalledWith("main-model-id");
    expect(mockRegisterKnowledgebaseTool).toHaveBeenCalledWith(
      ["kb-1"],
      true,
      "user-1",
      undefined,
      {
        model: { modelId: "main-model-id" },
        contextWindow: 16_384,
      },
    );
  });

  it("configures KB subagent with custom workerResolved model and context window when present", () => {
    const workerMockChat = vi.fn((id: string) => ({ modelId: id, isWorker: true }));
    const workerResolved = {
      modelId: "custom-worker-model",
      sdkProvider: {
        chat: workerMockChat,
      },
      contextWindow: 32_768,
    };

    buildOrchestratorToolSet({
      ...baseParams,
      ctx: {
        activeKbId: "kb-single",
        kbIsReady: true,
        availableSkills: [],
      },
      workerResolved,
    });

    expect(workerMockChat).toHaveBeenCalledWith("custom-worker-model");
    expect(mockRegisterKnowledgebaseTool).toHaveBeenCalledWith(
      ["kb-single"],
      true,
      "user-1",
      undefined,
      {
        model: { modelId: "custom-worker-model", isWorker: true },
        contextWindow: 32_768,
      },
    );
  });

  it("passes linkedSubagents to createSubagentDispatchTool when subagentsEnabled is true", () => {
    const linkedSubagents = [
      {
        id: "builtin:researcher",
        name: "Researcher",
      } as any,
    ];
    const res = buildOrchestratorToolSet({
      ...baseParams,
      subagentsEnabled: true,
      ctx: {
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
        linkedSubagents,
      },
    });

    expect(res.isSubagentDelegationEnabled).toBe(true);
    expect(res.subagentDispatchTools).toHaveProperty("delegate_task");
  });

  it("auto-enables subagent delegation when agentRow or projectRow has subagentIds and wires resolveModelById and buildIsolatedTools", async () => {
    mockRegisterMemoryTool.mockReturnValue({ save_memory: { description: "mem" } });
    mockRegisterSkillTool.mockReturnValue({ load_skill: { description: "skill" } });
    mockFilterToolsForAgent.mockImplementation((pool) => ({
      sub_mcp_tool: pool.sub_mcp_tool,
    }));

    const res = buildOrchestratorToolSet({
      ...baseParams,
      isMemoryEnabled: true,
      subagentsEnabled: false,
      mcpTools: { parent_tool: { description: "parent" } },
      subagentMcpTools: {
        parent_tool: { description: "parent" },
        sub_mcp_tool: { description: "sub" },
      },
      ctx: {
        chatRow: { id: "chat-1", projectId: "proj-1" },
        agentRow: { id: "orch-1", subagentIds: ["sub-1"] },
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [{ name: "skill-1" }],
        linkedSubagents: [{ id: "sub-1", name: "Sub 1" } as any],
      },
    });

    expect(res.isSubagentDelegationEnabled).toBe(true);
    expect(mockCreateSubagentDispatchTool).toHaveBeenCalledTimes(1);

    const dispatchConfig = mockCreateSubagentDispatchTool.mock.calls[0][0];
    expect(dispatchConfig.resolveModelById).toBeTypeOf("function");
    expect(dispatchConfig.buildIsolatedTools).toBeTypeOf("function");

    // Test resolveModelById success and failure
    mockResolveProvider.mockResolvedValueOnce({
      modelId: "sub-model-1",
      sdkProvider: { chat: vi.fn((id: string) => ({ modelId: `chat:${id}` })) },
    });
    const resolvedModel = await dispatchConfig.resolveModelById("sub-model-1");
    expect(resolvedModel).toEqual({ modelId: "chat:sub-model-1" });

    mockResolveProvider.mockRejectedValueOnce(new Error("Missing model"));
    const failedModel = await dispatchConfig.resolveModelById("missing");
    expect(failedModel).toBeUndefined();

    // Test buildIsolatedTools with skillMode !== "none"
    const isolatedWithSkills = dispatchConfig.buildIsolatedTools({
      id: "sub-1",
      tools: ["srv:tool:sub_mcp_tool"],
      knowledgebaseIds: ["kb-sub"],
      skillMode: "dynamic",
      skillIds: ["sk-1"],
    });
    expect(isolatedWithSkills).toHaveProperty("sub_mcp_tool");
    expect(isolatedWithSkills).toHaveProperty("load_skill");

    // Test buildIsolatedTools with skillMode === "none"
    const isolatedNoSkills = dispatchConfig.buildIsolatedTools({
      id: "sub-2",
      tools: [],
      knowledgebaseIds: [],
      skillMode: "none",
      skillIds: [],
    });
    expect(isolatedNoSkills).not.toHaveProperty("load_skill");

    // Test buildIsolatedTools when skillIds is empty and availableSkills is true
    const isolatedGlobalSkills = dispatchConfig.buildIsolatedTools({
      id: "sub-3",
      tools: [],
      knowledgebaseIds: [],
      skillMode: "dynamic",
      skillIds: [],
    });
    expect(isolatedGlobalSkills).toHaveProperty("load_skill");

    // Test buildKnowledgebaseTools callback
    dispatchConfig.buildKnowledgebaseTools(["kb-sub"]);
    expect(mockRegisterKnowledgebaseTool).toHaveBeenCalledWith(
      ["kb-sub"],
      true,
      "user-1",
      undefined,
      expect.anything(),
    );

    // Also test projectRow.subagentIds auto-enablement
    const projRes = buildOrchestratorToolSet({
      ...baseParams,
      subagentsEnabled: false,
      ctx: {
        projectRow: { subagentIds: ["builtin:researcher"] },
        activeKbId: null,
        kbIsReady: false,
        availableSkills: [],
      },
    });
    expect(projRes.isSubagentDelegationEnabled).toBe(true);
  });

  it("excludes blocked internal tools from orchestrator and subagents", () => {
    mockRegisterMemoryTool.mockReturnValue({ save_memory: { description: "mem" } });
    mockRegisterSkillTool.mockReturnValue({ load_skill: { description: "skill" } });
    mockRegisterKnowledgebaseTool.mockReturnValue({
      search_knowledge_base: { description: "kb" },
    });

    const res = buildOrchestratorToolSet({
      ...baseParams,
      isMemoryEnabled: true,
      subagentsEnabled: true,
      internalToolOverrides: {
        search_knowledge_base: "block",
        save_memory: "block",
        manage_artifact: "block",
        load_skill: "block",
        delegate_task: "block",
        get_file_url: "block",
      },
      fileAttachments: [{ name: "a.txt", key: "k1" }],
      ctx: {
        activeKbIds: ["kb-1"],
        kbIsReady: true,
        availableSkills: [{ name: "skill-1" }],
      },
    });

    expect(res.hasKbTool).toBe(false);
    expect(res.hasArtifactTool).toBe(false);
    expect(res.isSubagentDelegationEnabled).toBe(false);
    expect(res.orchestratorActiveTools).not.toHaveProperty("search_knowledge_base");
    expect(res.orchestratorActiveTools).not.toHaveProperty("save_memory");
    expect(res.orchestratorActiveTools).not.toHaveProperty("manage_artifact");
    expect(res.orchestratorActiveTools).not.toHaveProperty("load_skill");
    expect(res.orchestratorActiveTools).not.toHaveProperty("get_file_url");
    expect(res.subagentDispatchTools).not.toHaveProperty("delegate_task");
  });

  it("forwards internalToolOverrides, preUnlockedToolNames, and includeManageSkill to registerAppTools and keeps them out of isolatedToolPool", () => {
    mockRegisterMemoryTool.mockReturnValue({ save_memory: { description: "mem" } });
    mockRegisterSkillTool.mockReturnValue({ load_skill: { description: "skill" } });
    mockRegisterAppTools.mockReturnValue({
      app_help: { description: "help" },
      manage_project: { deferLoading: false },
    });
    mockRegisterKnowledgebaseTool.mockReturnValue({
      search_knowledge_base: { description: "kb" },
    });

    const preUnlocked = new Set(["manage_project"]);
    const res = buildOrchestratorToolSet({
      ...baseParams,
      subagentsEnabled: true,
      preUnlockedToolNames: preUnlocked,
      internalToolOverrides: {
        search_knowledge_base: "block",
        load_skill: "block",
        manage_workflow: "block",
      },
      ctx: {
        activeKbIds: [],
        kbIsReady: true,
        availableSkills: [{ name: "skill-1" }],
        linkedSubagents: [{ id: "sub-1", name: "Sub 1" } as any],
      },
    });

    expect(mockRegisterAppTools).toHaveBeenCalledWith("user-1", {
      internalToolOverrides: {
        search_knowledge_base: "block",
        load_skill: "block",
        manage_workflow: "block",
      },
      preUnlockedToolNames: preUnlocked,
      includeManageSkill: true,
    });
    expect(res.orchestratorActiveTools).toHaveProperty("app_help");
    expect(res.orchestratorActiveTools).toHaveProperty("manage_project");

    const dispatchConfig = mockCreateSubagentDispatchTool.mock.calls[0][0];
    const isolated = dispatchConfig.buildIsolatedTools({
      id: "sub-1",
      tools: [],
      knowledgebaseIds: ["kb-sub"],
      skillMode: "dynamic",
      skillIds: ["sk-1"],
    });
    expect(isolated).not.toHaveProperty("load_skill");
    expect(isolated).not.toHaveProperty("app_help");
    expect(isolated).not.toHaveProperty("manage_project");

    const kbTools = dispatchConfig.buildKnowledgebaseTools(["kb-sub"]);
    expect(kbTools).toEqual({});
  });

  it("filters blocked scratchpad tools from orchestratorActiveTools", () => {
    vi.mocked(registerScratchpadTools).mockReturnValueOnce({
      scratchpad_write: { description: "write" },
      scratchpad_read: { description: "read" },
    });
    mockRegisterAppTools.mockReturnValueOnce({});

    const res = buildOrchestratorToolSet({
      ...baseParams,
      subagentsEnabled: true,
      internalToolOverrides: {
        scratchpad_write: "block",
      },
    });

    expect(res.orchestratorActiveTools).not.toHaveProperty("scratchpad_write");
    expect(res.orchestratorActiveTools).toHaveProperty("scratchpad_read");
  });

  it("locks down tools to inspect_workspace, manage_workflow, and app_help when chatRow.workflowId is set", () => {
    const res = buildOrchestratorToolSet({
      ...baseParams,
      isMemoryEnabled: true,
      subagentsEnabled: true,
      selectedTools: ["internal:tool:manage_artifact"],
      mcpTools: { external_mcp: { description: "mcp" } },
      ctx: {
        chatRow: { id: "chat-1", projectId: null, workflowId: "wf-locked" },
        agentRow: null,
        activeKbId: "kb-1",
        kbIsReady: true,
        availableSkills: [{ name: "skill-1" }],
      },
    });

    expect(res.hasArtifactTool).toBe(false);
    expect(res.hasKbTool).toBe(false);
    expect(res.isSubagentDelegationEnabled).toBe(false);
    expect(Object.keys(res.allTools ?? {}).sort()).toEqual([
      "app_help",
      "inspect_workspace",
      "manage_workflow",
    ]);
  });
});
