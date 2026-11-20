import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectSubagentsTab } from "@/components/project/project-subagents-tab";
import type { Agent } from "@/types/agent/agent";

const leafAgent: Agent = {
  id: "leaf-1",
  userId: "user-1",
  name: "SQL Analyst",
  description: "Writes SQL",
  prompt: "",
  subagentPrompt: "",
  modelId: null,
  tools: [],
  skillMode: "dynamic",
  skillIds: [],
  promptMode: "all",
  promptIds: [],
  knowledgebaseIds: [],
  subagentIds: [],
  guardrails: null,
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ProjectSubagentsTab", () => {
  it("renders picker and calls onToggleSubagent and onSave", () => {
    const onToggleSubagent = vi.fn();
    const onSave = vi.fn();

    render(
      <ProjectSubagentsTab
        agents={[leafAgent]}
        selectedSubagentIds={["leaf-1"]}
        onToggleSubagent={onToggleSubagent}
        onSave={onSave}
      />,
    );

    expect(screen.getByText("Project Subagents")).toBeInTheDocument();
    expect(screen.getByText("SQL Analyst")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save subagents/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("disables save button while saving", () => {
    render(
      <ProjectSubagentsTab
        agents={[leafAgent]}
        selectedSubagentIds={[]}
        onToggleSubagent={vi.fn()}
        onSave={vi.fn()}
        isSaving={true}
      />,
    );

    expect(
      screen.getByRole("button", { name: /save subagents/i }),
    ).toBeDisabled();
  });
});
