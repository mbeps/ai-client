import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillsConfigTab } from "@/components/shared/skills-config-tab";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("SkillsConfigTab", () => {
  it("renders empty entity skills for project and agent, and saving state", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <SkillsConfigTab
        skills={[
          {
            id: "s-1",
            name: "Global Skill",
            description: "Desc",
            agentIds: [],
            assistantIds: undefined,
            projectIds: [],
          } as never,
        ]}
        selectedSkillIds={[]}
        onToggleSkill={vi.fn()}
        projectId="p-1"
        onSave={onSave}
        isSaving={true}
      />,
    );

    expect(
      screen.getByText(/No project-specific skills yet/i),
    ).toBeInTheDocument();

    rerender(
      <SkillsConfigTab
        skills={[
          {
            id: "s-2",
            name: "Agent Skill",
            description: "Desc",
            agentIds: ["a-1"],
            projectIds: [],
          } as never,
        ]}
        selectedSkillIds={[]}
        onToggleSkill={vi.fn()}
        agentId="a-1"
        onSave={onSave}
        isSaving={false}
      />,
    );

    expect(screen.getByText("Agent Skill")).toBeInTheDocument();
    const saveBtn = screen.getByRole("button", { name: /save/i });
    expect(saveBtn).toBeInTheDocument();
  });

  it("renders empty agent-specific skills state when agentId is provided", () => {
    render(
      <SkillsConfigTab
        agentId="a1"
        skills={[]}
        selectedSkillIds={[]}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/No agent-specific skills yet/i)).toBeInTheDocument();
  });
});
