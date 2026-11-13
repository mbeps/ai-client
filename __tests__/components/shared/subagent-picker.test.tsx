import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubagentPicker } from "@/components/shared/subagent-picker";
import { BUILT_IN_AGENTS } from "@/config/built-in-agents";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import type { Agent } from "@/types/agent/agent";

const makeCustomAgent = (
  id: string,
  name: string,
  overrides: Partial<Agent> = {},
): Agent => ({
  id,
  userId: "user-1",
  name,
  description: `${name} description`,
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
  isOrchestrator: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("SubagentPicker", () => {
  it("groups eligible built-in and custom leaf agents, excluding orchestrators, self, and kb-reader", () => {
    const agents: Agent[] = [
      ...BUILT_IN_AGENTS,
      makeCustomAgent("leaf-1", "Leaf Specialist"),
      makeCustomAgent("orch-1", "Orchestrator", {
        isOrchestrator: true,
        subagentIds: ["builtin:researcher"],
      }),
      makeCustomAgent("self-1", "Current Agent"),
    ];

    render(
      <SubagentPicker
        agents={agents}
        selectedIds={["builtin:researcher"]}
        onToggle={vi.fn()}
        excludeAgentId="self-1"
      />,
    );

    expect(screen.getByText("Built-in Agents")).toBeInTheDocument();
    expect(screen.getByText("Custom Leaf Agents")).toBeInTheDocument();
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.getByText("Leaf Specialist")).toBeInTheDocument();
    expect(screen.queryByText("Orchestrator")).not.toBeInTheDocument();
    expect(screen.queryByText("Current Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("KB Reader")).not.toBeInTheDocument();
  });

  it("calls onToggle when an eligible agent is clicked", () => {
    const onToggle = vi.fn();
    const agents = [makeCustomAgent("leaf-1", "Leaf Specialist")];

    render(
      <SubagentPicker agents={agents} selectedIds={[]} onToggle={onToggle} />,
    );

    fireEvent.click(screen.getByText("Leaf Specialist"));
    expect(onToggle).toHaveBeenCalledWith("leaf-1");
  });

  it("does not call onToggle when disabled and renders empty state when no eligible agents exist", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <SubagentPicker
        agents={[makeCustomAgent("leaf-1", "Leaf Specialist")]}
        selectedIds={[]}
        onToggle={onToggle}
        disabled
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).not.toHaveBeenCalled();

    rerender(
      <SubagentPicker
        agents={[]}
        selectedIds={[]}
        onToggle={onToggle}
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});
