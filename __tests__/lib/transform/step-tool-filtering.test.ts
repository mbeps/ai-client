import { beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { buildStepSystemPrompt } from "@/lib/transform/step-system-prompt";
import { filterStepTools } from "@/lib/transform/step-tool-filtering";
import type { TransformStep } from "@/types/transform/transform-step";

const registerSkillAuthoringToolsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/register-skill-authoring-tools", () => ({
  registerSkillAuthoringTools: registerSkillAuthoringToolsMock,
}));

const registerSkillToolMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/register-skill-tool", () => ({
  registerSkillTool: registerSkillToolMock,
}));

describe("filterStepTools", () => {
  const baseStep: TransformStep = {
    id: "step-1",
    name: "Step 1",
    prompt: "Prompt",
    order: 0,
    mcpServerIds: [],
    toolIds: [],
    requiresReview: false,
  };

  const baseAgent = {
    tools: null as string[] | null,
    requiresFileUpload: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registerSkillToolMock.mockReturnValue({ load_skill: { name: "load_skill" } });
    registerSkillAuthoringToolsMock.mockReturnValue({
      create_skill: { name: "create_skill" },
      update_skill: { name: "update_skill" },
      write_skill_file: { name: "write_skill_file" },
      delete_skill_file: { name: "delete_skill_file" },
    });
  });

  it("does NOT inject skill authoring tools when allowedToolIds is empty", () => {
    const { filteredTools } = filterStepTools({
      step: { ...baseStep, toolIds: undefined as any },
      agentRow: baseAgent,
      allServers: [],
      runMcpTools: {},
      runToolSourceMap: {},
      userId: "u1",
      skillCatalog: [],
      activeWorkbookFilePath: null,
      currentAttachmentRows: [],
    });

    expect(registerSkillAuthoringToolsMock).not.toHaveBeenCalled();
    expect(filteredTools.create_skill).toBeUndefined();
    expect(filteredTools.update_skill).toBeUndefined();
    expect(filteredTools.write_skill_file).toBeUndefined();
    expect(filteredTools.delete_skill_file).toBeUndefined();
  });

  it("injects skill authoring tools when MANAGE_SKILL is in step.toolIds", () => {
    const { filteredTools } = filterStepTools({
      step: { ...baseStep, toolIds: [INTERNAL_TOOL_IDS.MANAGE_SKILL] },
      agentRow: baseAgent,
      allServers: [],
      runMcpTools: {},
      runToolSourceMap: {},
      userId: "u1",
      skillCatalog: [],
      activeWorkbookFilePath: null,
      currentAttachmentRows: [],
    });

    expect(registerSkillAuthoringToolsMock).toHaveBeenCalledWith("u1");
    expect(filteredTools.create_skill).toBeDefined();
    expect(filteredTools.write_skill_file).toBeDefined();
  });

  it("injects skill authoring tools when MANAGE_SKILL is in agentRow.tools", () => {
    const { filteredTools } = filterStepTools({
      step: baseStep,
      agentRow: { ...baseAgent, tools: [INTERNAL_TOOL_IDS.MANAGE_SKILL] },
      allServers: [],
      runMcpTools: {},
      runToolSourceMap: {},
      userId: "u1",
      skillCatalog: [],
      activeWorkbookFilePath: null,
      currentAttachmentRows: [],
    });

    expect(registerSkillAuthoringToolsMock).toHaveBeenCalledWith("u1");
    expect(filteredTools.create_skill).toBeDefined();
  });

  it("registers delegate_task when DELEGATE_TASK is allowed and linkedSubagents and resolvedProvider are provided", async () => {
    const customSubagent = {
      id: "custom-sub-1",
      name: "Sheet Researcher",
      description: "Researches topics",
      tools: ["srv-1:tool:fetch_data"],
      knowledgebaseIds: [],
      guardrails: { maxSteps: 5, scratchpadAccess: "none", isolateTools: true },
    } as any;

    const { filteredTools } = filterStepTools({
      step: { ...baseStep, toolIds: [INTERNAL_TOOL_IDS.DELEGATE_TASK] },
      agentRow: { ...baseAgent, tools: [] },
      allServers: [{ id: "srv-1", name: "Server1" }],
      runMcpTools: {
        fetch_data: { name: "fetch_data" },
        unallowed_tool: { name: "unallowed_tool" },
      },
      runToolSourceMap: {
        fetch_data: "Server1",
        unallowed_tool: "Server1",
      },
      userId: "u1",
      skillCatalog: [],
      activeWorkbookFilePath: null,
      currentAttachmentRows: [],
      linkedSubagents: [customSubagent],
      resolvedProvider: {
        modelId: "gpt-4o",
        sdkProvider: { chat: vi.fn((id: string) => ({ modelId: id })) },
      } as any,
    });

    expect(filteredTools.delegate_task).toBeDefined();
    // Filtered tools for parent step should NOT have fetch_data because step.toolIds only has DELEGATE_TASK
    expect(filteredTools.fetch_data).toBeUndefined();

    // Execute delegate_task or inspect how buildIsolatedTools filters from runMcpTools
    const chunks: any[] = [];
    for await (const chunk of filteredTools.delegate_task.execute(
      { agent: "custom-sub-1", taskBrief: "Check isolated tools" },
      { abortSignal: new AbortController().signal },
    )) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);

    const promptWithSubagents = buildStepSystemPrompt({
      step: baseStep,
      agentRow: { globalContext: null, tools: [] },
      filteredTools,
      skillCatalog: [],
      preloadedSkills: [],
      kbContext: "",
      fileContext: "",
      linkedSubagents: [
        {
          id: "builtin:researcher",
          name: "Researcher",
          description: "Researches topics",
        } as any,
      ],
    });
    expect(promptWithSubagents).toContain("## Available Subagents");

    const promptWithoutSubagents = buildStepSystemPrompt({
      step: baseStep,
      agentRow: { globalContext: null, tools: [] },
      filteredTools,
      skillCatalog: [],
      preloadedSkills: [],
      kbContext: "",
      fileContext: "",
      linkedSubagents: [],
    });
    expect(promptWithoutSubagents).not.toContain("## Available Subagents");
  });

  it("preserves System search_knowledge_base tool even when step.toolIds restricts to other tools", () => {
    const { filteredTools, toolSourceMap } = filterStepTools({
      step: { ...baseStep, toolIds: ["srv-1:tool:fetch_data"] },
      agentRow: baseAgent,
      allServers: [{ id: "srv-1", name: "Server1" }],
      runMcpTools: {
        fetch_data: { name: "fetch_data" },
        search_knowledge_base: { name: "search_knowledge_base" },
      },
      runToolSourceMap: {
        fetch_data: "Server1",
        search_knowledge_base: "System",
      },
      userId: "u1",
      skillCatalog: [],
      activeWorkbookFilePath: null,
      currentAttachmentRows: [],
    });

    expect(filteredTools.fetch_data).toBeDefined();
    expect(filteredTools.search_knowledge_base).toBeDefined();
    expect(toolSourceMap.search_knowledge_base).toBe("System");
  });
});

