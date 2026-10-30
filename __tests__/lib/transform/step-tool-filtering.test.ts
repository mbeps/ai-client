import { beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
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
      step: baseStep,
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
});

