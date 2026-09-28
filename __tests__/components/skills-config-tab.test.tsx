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
});
