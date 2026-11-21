import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubagentsConfigTab } from "@/components/shared/subagents-config-tab";
import { BUILT_IN_AGENTS } from "@/config/built-in-agents";

describe("SubagentsConfigTab", () => {
  it("renders Rule 2 lock banner and disables saving when usedByCount > 0", () => {
    render(
      <SubagentsConfigTab
        agentId="leaf-1"
        agents={[...BUILT_IN_AGENTS]}
        selectedSubagentIds={[]}
        onToggleSubagent={vi.fn()}
        usedByCount={2}
        onSave={vi.fn()}
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
      <SubagentsConfigTab
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
      <SubagentsConfigTab
        title="Project Subagents"
        description="Select subagents for this project."
        agentId="orch-1"
        agents={[...BUILT_IN_AGENTS]}
        selectedSubagentIds={[]}
        onToggleSubagent={onToggle}
        usedByCount={0}
        onSave={onSave}
      />,
    );

    expect(screen.getByText("Project Subagents")).toBeInTheDocument();
    expect(
      screen.getByText("Select subagents for this project."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Researcher"));
    expect(onToggle).toHaveBeenCalledWith("builtin:researcher");

    fireEvent.click(screen.getByRole("button", { name: /save subagents/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("disables save button while saving and hides it when disabled is true", () => {
    const { rerender } = render(
      <SubagentsConfigTab
        agents={[...BUILT_IN_AGENTS]}
        selectedSubagentIds={[]}
        onToggleSubagent={vi.fn()}
        onSave={vi.fn()}
        isSaving
      />,
    );

    expect(
      screen.getByRole("button", { name: /save subagents/i }),
    ).toBeDisabled();

    rerender(
      <SubagentsConfigTab
        agents={[...BUILT_IN_AGENTS]}
        selectedSubagentIds={[]}
        onToggleSubagent={vi.fn()}
        onSave={vi.fn()}
        disabled
      />,
    );

    expect(
      screen.queryByRole("button", { name: /save subagents/i }),
    ).not.toBeInTheDocument();
  });
});
