import { describe, expect, it } from "vitest";
import {
  createAgentWorkflowNode,
  createDefaultWorkflowNode,
} from "@/components/workflows/editor/workflow-editor-helpers";
import { variableNameField } from "@/schemas/workflows/workflow";
import type { Agent } from "@/types/agent/agent";
import type { WorkflowNode } from "@/types/workflows/workflow";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    userId: "user-1",
    name: "Research Assistant",
    description: "Finds and summarizes sources",
    prompt: "You are a researcher.",
    subagentPrompt: "",
    modelId: null,
    knowledgebaseIds: [],
    tools: [],
    skillMode: "dynamic",
    skillIds: [],
    promptMode: "all",
    promptIds: [],
    subagentIds: [],
    guardrails: {},
    avatar: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("createAgentWorkflowNode", () => {
  it("creates an ai_step node bound to the agent with a valid sanitized variableName", () => {
    const agent = makeAgent({ id: "agent-research", name: "Research Assistant" });
    const node = createAgentWorkflowNode(agent, { x: 120, y: 240 }, []);

    expect(node.type).toBe("ai_step");
    expect(node.name).toBe("Research Assistant");
    expect(node.position).toEqual({ x: 120, y: 240 });
    expect(node.data).toMatchObject({
      kind: "ai_step",
      agentId: "agent-research",
      prompt: "",
      mcpServerIds: [],
      toolIds: [],
      requiresReview: false,
    });
    expect(variableNameField.safeParse(node.data.variableName).success).toBe(true);
    expect(node.data.variableName).toBe("research_assistant1");
  });

  it("increments variableName suffix when colliding with existing nodes", () => {
    const agent = makeAgent({ name: "Writer Bot" });
    const first = createAgentWorkflowNode(agent, { x: 0, y: 0 }, []);
    const second = createAgentWorkflowNode(agent, { x: 40, y: 40 }, [first]);

    expect(first.data.variableName).toBe("writer_bot1");
    expect(second.data.variableName).toBe("writer_bot2");
  });

  it("falls back to a valid identifier for numeric or symbol-only agent names", () => {
    const numericAgent = makeAgent({ name: "12345" });
    const symbolAgent = makeAgent({ name: "!!!" });
    const longAgent = makeAgent({ name: "a".repeat(100) });

    const existing: WorkflowNode[] = [
      createDefaultWorkflowNode("manual_trigger", { x: 0, y: 0 }, []),
    ];

    const n1 = createAgentWorkflowNode(numericAgent, { x: 0, y: 0 }, existing);
    const n2 = createAgentWorkflowNode(symbolAgent, { x: 0, y: 0 }, [...existing, n1]);
    const n3 = createAgentWorkflowNode(longAgent, { x: 0, y: 0 }, existing);

    expect(variableNameField.safeParse(n1.data.variableName).success).toBe(true);
    expect(variableNameField.safeParse(n2.data.variableName).success).toBe(true);
    expect(variableNameField.safeParse(n3.data.variableName).success).toBe(true);
    expect(n1.data.variableName).toBe("agent1");
    expect(n2.data.variableName).toBe("agent2");
  });
});
