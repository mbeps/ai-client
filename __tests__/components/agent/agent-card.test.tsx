import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentCard } from "@/components/agent/agent-card";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import type { Agent } from "@/types/agent/agent";

vi.mock("@/components/agent/agent-options", () => ({
  AgentOptions: () => <div data-testid="agent-options" />,
}));

const baseAgent: Agent = {
  id: "agent-1",
  userId: "user-1",
  name: "Test Agent",
  description: "Agent description",
  prompt: "",
  subagentPrompt: "",
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
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("AgentCard", () => {
  it("renders Subagent badge and no Used by badge when usedByCount is undefined or 0", () => {
    render(<AgentCard agent={baseAgent} />);
    expect(screen.getByText("Subagent")).toBeInTheDocument();
    expect(screen.queryByText(/Used by/i)).not.toBeInTheDocument();
  });

  it("renders Built-in badge and Used by badge when usedByCount > 0", () => {
    render(
      <AgentCard
        agent={{ ...baseAgent, isBuiltIn: true, usedByCount: 3 }}
      />,
    );
    expect(screen.getByText("Built-in")).toBeInTheDocument();
    expect(screen.getByText("Used by 3")).toBeInTheDocument();
  });

  it("renders Orchestrator badge when subagentIds is non-empty", () => {
    render(
      <AgentCard
        agent={{ ...baseAgent, subagentIds: ["sub-1", "sub-2"] }}
      />,
    );
    expect(screen.getByText("Orchestrator (2)")).toBeInTheDocument();
  });
});
