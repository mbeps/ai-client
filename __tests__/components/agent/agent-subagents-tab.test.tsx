import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentSubagentsTab } from "@/components/agent/agent-subagents-tab";
import { BUILT_IN_AGENTS } from "@/config/built-in-agents";

describe("AgentSubagentsTab", () => {
  it("renders Rule 2 lock banner and disables saving when usedByCount > 0", () => {
    const onSave = vi.fn();
    render(
      <AgentSubagentsTab
        agentId="leaf-1"
        agents={[...BUILT_IN_AGENTS]}
        selectedSubagentIds={[]}
        onToggleSubagent={vi.fn()}
        usedByCount={2}
        onSave={onSave}
      />,
    );

    expect(
      screen.getByText("Currently Linked as a Subagent"),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 parents/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save subagents/i }),
    ).toBeDisabled();
  });

  it("renders singular parent text when usedByCount === 1", () => {
    render(
      <AgentSubagentsTab
        agentId="leaf-1"
        agents={[...BUILT_IN_AGENTS]}
        selectedSubagentIds={[]}
        onToggleSubagent={vi.fn()}
        usedByCount={1}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText(/1 parent \(/i)).toBeInTheDocument();
  });

  it("allows toggling and saving when usedByCount === 0", () => {
    const onSave = vi.fn();
    const onToggle = vi.fn();
    render(
      <AgentSubagentsTab
        agentId="orch-1"
        agents={[...BUILT_IN_AGENTS]}
        selectedSubagentIds={[]}
        onToggleSubagent={onToggle}
        usedByCount={0}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByText("Researcher"));
    expect(onToggle).toHaveBeenCalledWith("builtin:researcher");

    fireEvent.click(screen.getByRole("button", { name: /save subagents/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
