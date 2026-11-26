import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import { resolveEffectiveAiStepConfig } from "@/lib/workflows/resolve-effective-ai-step-config";
import type { Agent } from "@/types/agent/agent";
import type { AiStepNodeData } from "@/types/workflows/workflow";

const BASE_WORKFLOW = {
  modelId: "wf-model",
  reasoningEffort: "low" as const,
  knowledgeBaseIds: ["wf-kb"],
  skillMode: "specific" as const,
  skillIds: ["wf-skill"],
  subagentIds: ["wf-sub"],
  tools: ["internal:tool:manage_artifact", "srv-wf:tool:search"],
};

const BASE_AGENT: Agent = {
  id: "agent-1",
  userId: "user-1",
  name: "Researcher",
  description: "Researches",
  prompt: "You are a diligent researcher.",
  subagentPrompt: "Sub prompt",
  modelId: "agent-model",
  reasoningEffort: "high",
  knowledgebaseIds: ["agent-kb"],
  tools: ["internal:tool:save_memory", "srv-agent:tool:fetch"],
  skillMode: "dynamic",
  skillIds: ["agent-skill"],
  promptMode: "all",
  promptIds: [],
  subagentIds: ["agent-sub"],
  guardrails: DEFAULT_AGENT_GUARDRAILS,
  avatar: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function makeNodeData(overrides: Partial<AiStepNodeData> = {}): AiStepNodeData {
  return {
    kind: "ai_step",
    variableName: "step1",
    prompt: "Do work",
    mcpServerIds: [],
    toolIds: [],
    requiresReview: false,
    ...overrides,
  };
}

describe("resolveEffectiveAiStepConfig", () => {
  it("gives explicit node overrides precedence over linked agent and workflow", () => {
    const config = resolveEffectiveAiStepConfig({
      nodeData: makeNodeData({
        modelId: "node-model",
        reasoningEffort: "medium",
        knowledgeBaseIds: ["node-kb"],
        skillMode: "none",
        skillIds: ["node-skill"],
        subagentIds: ["node-sub"],
        toolIds: ["srv-node:tool:run"],
        mcpServerIds: ["srv-explicit"],
      }),
      linkedAgent: BASE_AGENT,
      workflowRow: BASE_WORKFLOW,
    });

    expect(config).toEqual({
      modelId: "node-model",
      reasoningEffort: "medium",
      knowledgeBaseIds: ["node-kb"],
      skillMode: "none",
      skillIds: ["node-skill"],
      subagentIds: ["node-sub"],
      toolIds: ["srv-node:tool:run"],
      mcpServerIds: ["srv-explicit"],
      agentPersonaPrompt: "You are a diligent researcher.",
    });
  });

  it("pairs reasoningEffort strictly with the layer that supplied modelId", () => {
    const nodeModelNoEffort = resolveEffectiveAiStepConfig({
      nodeData: makeNodeData({ modelId: "node-model" }),
      linkedAgent: BASE_AGENT,
      workflowRow: BASE_WORKFLOW,
    });
    expect(nodeModelNoEffort.modelId).toBe("node-model");
    expect(nodeModelNoEffort.reasoningEffort).toBeUndefined();

    const agentModelNullEffort = resolveEffectiveAiStepConfig({
      nodeData: makeNodeData({ reasoningEffort: "medium" }),
      linkedAgent: { ...BASE_AGENT, modelId: "agent-model", reasoningEffort: null },
      workflowRow: BASE_WORKFLOW,
    });
    expect(agentModelNullEffort.modelId).toBe("agent-model");
    expect(agentModelNullEffort.reasoningEffort).toBeUndefined();
  });

  it("falls back to linked agent defaults and extracts non-internal server IDs", () => {
    const config = resolveEffectiveAiStepConfig({
      nodeData: makeNodeData({ skillMode: "inherit" }),
      linkedAgent: {
        ...BASE_AGENT,
        tools: [
          "internal:tool:save_memory",
          "srv-agent:tool:fetch",
          "srv-agent:tool:search",
          "srv-2:tool:create",
          "malformed-id",
        ],
      },
      workflowRow: BASE_WORKFLOW,
    });

    expect(config).toEqual({
      modelId: "agent-model",
      reasoningEffort: "high",
      knowledgeBaseIds: ["agent-kb"],
      skillMode: "dynamic",
      skillIds: ["agent-skill"],
      subagentIds: ["agent-sub"],
      toolIds: [
        "internal:tool:save_memory",
        "srv-agent:tool:fetch",
        "srv-agent:tool:search",
        "srv-2:tool:create",
        "malformed-id",
      ],
      mcpServerIds: ["srv-agent", "srv-2"],
      agentPersonaPrompt: "You are a diligent researcher.",
    });
  });

  it("falls back to workflow defaults when node overrides and linked agent values are absent", () => {
    const config = resolveEffectiveAiStepConfig({
      nodeData: makeNodeData(),
      linkedAgent: {
        ...BASE_AGENT,
        prompt: "",
        modelId: null,
        reasoningEffort: null,
        knowledgebaseIds: [],
        tools: [],
        subagentIds: [],
      },
      workflowRow: BASE_WORKFLOW,
    });

    expect(config).toEqual({
      modelId: "wf-model",
      reasoningEffort: "low",
      knowledgeBaseIds: ["wf-kb"],
      skillMode: "dynamic",
      skillIds: ["agent-skill"],
      subagentIds: ["wf-sub"],
      toolIds: ["internal:tool:manage_artifact", "srv-wf:tool:search"],
      mcpServerIds: ["srv-wf"],
      agentPersonaPrompt: undefined,
    });
  });

  it("handles missing linkedAgent and empty workflow defaults", () => {
    const config = resolveEffectiveAiStepConfig({
      nodeData: makeNodeData({ skillMode: "specific" }),
      linkedAgent: null,
      workflowRow: {},
    });

    expect(config).toEqual({
      modelId: null,
      reasoningEffort: undefined,
      knowledgeBaseIds: [],
      skillMode: "specific",
      skillIds: [],
      subagentIds: [],
      toolIds: [],
      mcpServerIds: [],
      agentPersonaPrompt: undefined,
    });

    const fallbackConfig = resolveEffectiveAiStepConfig({
      nodeData: makeNodeData(),
      workflowRow: { modelId: null, reasoningEffort: null },
    });

    expect(fallbackConfig).toEqual({
      modelId: null,
      reasoningEffort: undefined,
      knowledgeBaseIds: [],
      skillMode: "dynamic",
      skillIds: [],
      subagentIds: [],
      toolIds: [],
      mcpServerIds: [],
      agentPersonaPrompt: undefined,
    });
  });
});
