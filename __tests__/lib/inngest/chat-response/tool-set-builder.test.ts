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

vi.mock("@/lib/chat/register-memory-tool", () => ({
  registerMemoryTool: vi.fn(() => ({})),
}));

vi.mock("@/lib/chat/register-skill-tool", () => ({
  registerSkillTool: vi.fn(() => ({})),
}));

vi.mock("@/lib/chat/register-skill-authoring-tools", () => ({
  registerSkillAuthoringTools: vi.fn(() => ({})),
}));

vi.mock("@/lib/subagents/create-subagent-dispatch-tool", () => ({
  createSubagentDispatchTool: vi.fn(() => ({})),
}));

vi.mock("@/lib/subagents/register-subagent-tools", () => ({
  registerScratchpadTools: vi.fn(() => ({})),
}));

import { buildOrchestratorToolSet } from "@/lib/inngest/chat-response/tool-set-builder";

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
});
