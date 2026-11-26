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
    expect(screen.getByText("Custom Agents")).toBeInTheDocument();
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

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Leaf Specialist/i }),
    );
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

  it("collapses and expands Built-in Agents and Custom Agents sections on header click", () => {
    const agents: Agent[] = [
      ...BUILT_IN_AGENTS,
      makeCustomAgent("leaf-1", "Leaf Specialist"),
    ];

    render(
      <SubagentPicker
        agents={agents}
        selectedIds={["builtin:researcher"]}
        onToggle={vi.fn()}
        defaultExpanded={false}
      />,
    );

    // Both groups start collapsed when defaultExpanded is false
    expect(screen.queryByText("Researcher")).not.toBeInTheDocument();
    expect(screen.queryByText("Leaf Specialist")).not.toBeInTheDocument();

    // Expand Built-in Agents
    fireEvent.click(screen.getByText("Built-in Agents"));
    expect(screen.getByText("Researcher")).toBeInTheDocument();

    // Expand Custom Agents
    fireEvent.click(screen.getByText("Custom Agents"));
    expect(screen.getByText("Leaf Specialist")).toBeInTheDocument();

    // Collapse Built-in Agents
    fireEvent.click(screen.getByText("Built-in Agents"));
    expect(screen.queryByText("Researcher")).not.toBeInTheDocument();
  });

  it("supports group-level checkbox bulk select and deselect without toggling accordion", () => {
    const onSelectIds = vi.fn();
    const onToggle = vi.fn();
    const agents: Agent[] = [
      ...BUILT_IN_AGENTS,
      makeCustomAgent("leaf-1", "Leaf One"),
      makeCustomAgent("leaf-2", "Leaf Two"),
    ];

    const { rerender } = render(
      <SubagentPicker
        agents={agents}
        selectedIds={[]}
        onToggle={onToggle}
        onSelectIds={onSelectIds}
      />,
    );

    // Select all Custom Agents via group checkbox
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all Custom Agents" }),
    );
    expect(onSelectIds).toHaveBeenCalledWith(["leaf-1", "leaf-2"]);
    // Group remains expanded
    expect(screen.getByText("Leaf One")).toBeInTheDocument();

    // Deselect all Built-in Agents via group checkbox when all built-ins are selected
    rerender(
      <SubagentPicker
        agents={agents}
        selectedIds={[
          "builtin:researcher",
          "builtin:planner",
          "builtin:reviewer",
          "builtin:worker",
          "leaf-1",
        ]}
        onToggle={onToggle}
        onSelectIds={onSelectIds}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all Built-in Agents" }),
    );
    expect(onSelectIds).toHaveBeenCalledWith(["leaf-1"]);
  });

  it("filters agents by search input, auto-expands matching groups, and shows empty search message", () => {
    const agents: Agent[] = [
      ...BUILT_IN_AGENTS,
      makeCustomAgent("leaf-1", "SQL Analyst", {
        description: "Queries relational databases",
      }),
    ];

    render(
      <SubagentPicker
        agents={agents}
        selectedIds={[]}
        onToggle={vi.fn()}
        defaultExpanded={false}
      />,
    );

    expect(screen.queryByText("SQL Analyst")).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Search subagents...");
    fireEvent.change(searchInput, { target: { value: "relational" } });

    expect(screen.getByText("SQL Analyst")).toBeInTheDocument();
    expect(screen.queryByText("Researcher")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "nonexistent-xyz" } });
    expect(
      screen.getByText(/No subagents found matching "nonexistent-xyz"/),
    ).toBeInTheDocument();
  });

  it("renders top-level Select All / Deselect All button and selected counter", () => {
    const onSelectIds = vi.fn();
    const onToggle = vi.fn();
    const agents: Agent[] = [
      makeCustomAgent("leaf-1", "Leaf One"),
      makeCustomAgent("leaf-2", "Leaf Two"),
    ];

    const { rerender } = render(
      <SubagentPicker
        agents={agents}
        selectedIds={[]}
        onToggle={onToggle}
        onSelectIds={onSelectIds}
      />,
    );

    expect(screen.getByText("2 subagents available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Select All/i }));
    expect(onSelectIds).toHaveBeenCalledWith(["leaf-1", "leaf-2"]);

    // Rerender with 1 selected -> still shows Select All and 1/2 selected subagents
    rerender(
      <SubagentPicker
        agents={agents}
        selectedIds={["leaf-1"]}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText("1/2 selected subagents")).toBeInTheDocument();

    // Without onSelectIds, Select All falls back to calling onToggle for unselected items
    fireEvent.click(screen.getByRole("button", { name: /Select All/i }));
    expect(onToggle).toHaveBeenCalledWith("leaf-2");
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Rerender with all selected -> shows Deselect All and falls back to onToggle for all
    onToggle.mockClear();
    rerender(
      <SubagentPicker
        agents={agents}
        selectedIds={["leaf-1", "leaf-2"]}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText("2/2 selected subagents")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Deselect All/i }));
    expect(onToggle).toHaveBeenCalledWith("leaf-1");
    expect(onToggle).toHaveBeenCalledWith("leaf-2");
  });

  it("handles search when agent description is null", () => {
    const agents: Agent[] = [
      makeCustomAgent("leaf-1", "Alpha", { description: null as never }),
    ];
    render(
      <SubagentPicker agents={agents} selectedIds={[]} onToggle={vi.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search subagents/i), {
      target: { value: "nonexistent" },
    });
    expect(screen.getByText(/no subagents/i)).toBeInTheDocument();
  });
});
