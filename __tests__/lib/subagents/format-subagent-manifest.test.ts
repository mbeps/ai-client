import { describe, expect, it } from "vitest";
import { BUILT_IN_AGENTS, isLinkableBuiltInAgentId } from "@/config/built-in-agents";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import { formatSubagentManifest } from "@/lib/subagents/format-subagent-manifest";
import type { Agent } from "@/types/agent/agent";

const linkableBuiltIns = BUILT_IN_AGENTS.filter((a) =>
  isLinkableBuiltInAgentId(a.id),
);

function makeCustomAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "user-1",
    name: "SQL Analyst",
    description: "Writes and optimizes PostgreSQL queries.",
    prompt: "You are an expert SQL analyst.",
    subagentPrompt: "Focus on read-only query analysis.",
    modelId: null,
    knowledgebaseIds: [],
    tools: [],
    skillMode: "dynamic",
    skillIds: [],
    promptMode: "all",
    promptIds: [],
    subagentIds: [],
    guardrails: DEFAULT_AGENT_GUARDRAILS,
    avatar: null,
    isBuiltIn: false,
    isOrchestrator: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("formatSubagentManifest", () => {
  it("returns empty string when no subagents are provided", () => {
    expect(formatSubagentManifest([])).toBe("");
  });

  it("renders built-in and custom leaf agents with IDs, names, and descriptions", () => {
    const custom = makeCustomAgent();
    const manifest = formatSubagentManifest([...linkableBuiltIns, custom]);

    expect(manifest).toContain("## Available Subagents");
    expect(manifest).toContain("delegate_task");
    expect(manifest).toContain("builtin:researcher");
    expect(manifest).toContain("Researcher");
    expect(manifest).toContain("SQL Analyst");
    expect(manifest).toContain("11111111-1111-4111-8111-111111111111");
    expect(manifest).toContain("Writes and optimizes PostgreSQL queries.");
  });

  it("falls back to default description when custom agent description is empty", () => {
    const custom = makeCustomAgent({ description: "" });
    const manifest = formatSubagentManifest([custom]);

    expect(manifest).toContain("SQL Analyst");
    expect(manifest).toContain("11111111-1111-4111-8111-111111111111");
    expect(manifest).toContain("General-purpose subagent.");
  });
});
