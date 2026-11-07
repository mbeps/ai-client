import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillsConfigTab } from "@/components/shared/skills-config-tab";
import type { Skill } from "@/types/skill/skill";

const mockSkills: Skill[] = [
  {
    id: "s1",
    name: "test-skill",
    displayName: "Test Skill",
    description: "A skill for testing",
    content: "Instructions",
    files: [],
    enabled: true,
    userId: "u1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("SkillsConfigTab", () => {
  it("renders 3 mode options: dynamic, none, specific", () => {
    const onModeChange = vi.fn();
    render(
      <SkillsConfigTab
        skillMode="dynamic"
        onSkillModeChange={onModeChange}
        selectedSkillIds={new Set()}
        onToggleSkill={vi.fn()}
        skills={mockSkills}
      />,
    );

    expect(screen.getByText(/dynamic loading/i)).toBeInTheDocument();
    expect(screen.getByText(/no skills/i)).toBeInTheDocument();
    expect(screen.getByText(/specific skills/i)).toBeInTheDocument();
  });

  it("calls onSkillModeChange when a mode card is clicked", () => {
    const onModeChange = vi.fn();
    render(
      <SkillsConfigTab
        skillMode="dynamic"
        onSkillModeChange={onModeChange}
        selectedSkillIds={new Set()}
        onToggleSkill={vi.fn()}
        skills={mockSkills}
      />,
    );

    fireEvent.click(screen.getByText(/no skills/i));
    expect(onModeChange).toHaveBeenCalledWith("none");

    fireEvent.click(screen.getByText(/specific skills/i));
    expect(onModeChange).toHaveBeenCalledWith("specific");
  });

  it("shows SkillsPicker only when specific skills mode is active", () => {
    const { rerender } = render(
      <SkillsConfigTab
        skillMode="dynamic"
        onSkillModeChange={vi.fn()}
        selectedSkillIds={new Set()}
        onToggleSkill={vi.fn()}
        skills={mockSkills}
      />,
    );
    expect(
      screen.queryByPlaceholderText(/search skills/i),
    ).not.toBeInTheDocument();

    rerender(
      <SkillsConfigTab
        skillMode="specific"
        onSkillModeChange={vi.fn()}
        selectedSkillIds={new Set()}
        onToggleSkill={vi.fn()}
        skills={mockSkills}
      />,
    );
    expect(screen.getByPlaceholderText(/search skills/i)).toBeInTheDocument();
  });

  it("renders Project Skills section and handles project specific skills", () => {
    const projectSkill: Skill = {
      ...mockSkills[0],
      id: "proj-sk-1",
      name: "proj-skill",
      displayName: "Project Skill",
      projectId: "proj-1",
    };

    render(
      <SkillsConfigTab
        projectId="proj-1"
        skillMode="dynamic"
        onSkillModeChange={vi.fn()}
        selectedSkillIds={new Set()}
        onToggleSkill={vi.fn()}
        skills={[...mockSkills, projectSkill]}
      />,
    );

    expect(screen.getByText("Project Skills")).toBeInTheDocument();
    expect(screen.getByText("Project Skill")).toBeInTheDocument();
    const newSkillLink = screen.getByRole("link", { name: /new skill/i });
    expect(newSkillLink).toHaveAttribute(
      "href",
      "/settings/skills/new?projectId=proj-1",
    );
  });

  it("renders Assistant Skills section and handles assistant specific skills", () => {
    const assistantSkill: Skill = {
      ...mockSkills[0],
      id: "asst-sk-1",
      name: "asst-skill",
      displayName: "Assistant Skill",
      assistantId: "asst-1",
    };

    render(
      <SkillsConfigTab
        assistantId="asst-1"
        skillMode="dynamic"
        onSkillModeChange={vi.fn()}
        selectedSkillIds={new Set()}
        onToggleSkill={vi.fn()}
        skills={[...mockSkills, assistantSkill]}
      />,
    );

    expect(screen.getByText("Assistant Skills")).toBeInTheDocument();
    expect(screen.getByText("Assistant Skill")).toBeInTheDocument();
    const newSkillLink = screen.getByRole("link", { name: /new skill/i });
    expect(newSkillLink).toHaveAttribute(
      "href",
      "/settings/skills/new?assistantId=asst-1",
    );
  });

  it("renders empty state when entity has no scoped skills", () => {
    render(
      <SkillsConfigTab
        projectId="proj-2"
        skillMode="dynamic"
        onSkillModeChange={vi.fn()}
        selectedSkillIds={new Set()}
        onToggleSkill={vi.fn()}
        skills={mockSkills}
      />,
    );

    expect(screen.getByText("Project Skills")).toBeInTheDocument();
    expect(
      screen.getByText(/no project-specific skills yet/i),
    ).toBeInTheDocument();
  });
});
