import { describe, expect, it } from "vitest";
import {
  agent,
  DEFAULT_AGENT_GUARDRAILS,
} from "@/drizzle/schemas/agent-schema";
import { chat } from "@/drizzle/schemas/chat-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { prompt } from "@/drizzle/schemas/prompt-schema";
import { skill } from "@/drizzle/schemas/skill-schema";
import { transformAgent } from "@/drizzle/schemas/transform-agent-schema";

describe("Database Agent Schema", () => {
  it("should define all unified agent columns", () => {
    expect(agent.id).toBeDefined();
    expect(agent.userId).toBeDefined();
    expect(agent.name).toBeDefined();
    expect(agent.description).toBeDefined();
    expect(agent.prompt).toBeDefined();
    expect(agent.subagentPrompt).toBeDefined();
    expect(agent.modelId).toBeDefined();
    expect(agent.knowledgebaseIds).toBeDefined();
    expect(agent.tools).toBeDefined();
    expect(agent.skillMode).toBeDefined();
    expect(agent.skillIds).toBeDefined();
    expect(agent.promptMode).toBeDefined();
    expect(agent.promptIds).toBeDefined();
    expect(agent.subagentIds).toBeDefined();
    expect(agent.guardrails).toBeDefined();
    expect(agent.avatar).toBeDefined();
    expect(agent.createdAt).toBeDefined();
    expect(agent.updatedAt).toBeDefined();
  });

  it("should export DEFAULT_AGENT_GUARDRAILS with expected defaults", () => {
    expect(DEFAULT_AGENT_GUARDRAILS).toEqual({
      maxSteps: 10,
      scratchpadAccess: "read_write",
      isolateTools: true,
    });
  });

  it("should have agentId on chat schema", () => {
    expect(chat.agentId).toBeDefined();
  });

  it("should have subagentIds on project and transformAgent schemas", () => {
    expect(project.subagentIds).toBeDefined();
    expect(transformAgent.subagentIds).toBeDefined();
  });

  it("should have agentIds on skill and prompt schemas", () => {
    expect(skill.agentIds).toBeDefined();
    expect(prompt.agentIds).toBeDefined();
  });
});
