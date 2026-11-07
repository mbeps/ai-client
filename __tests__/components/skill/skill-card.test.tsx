import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDeleteSkill = vi.fn();
vi.mock("@/actions/skills/delete-skill", () => ({
  deleteSkill: (id: string) => mockDeleteSkill(id),
}));

const mockToggleSkillEnabled = vi.fn();
vi.mock("@/actions/skills/toggle-skill", () => ({
  toggleSkillEnabled: (id: string, enabled: boolean) =>
    mockToggleSkillEnabled(id, enabled),
}));

import { SkillCard } from "@/components/skill/skill-card";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Skill } from "@/types/skill/skill";

describe("SkillCard", () => {
  const mockProjects = [
    {
      id: "proj-1",
      name: "Alpha Project",
    },
  ];

  const mockAssistants = [
    {
      id: "asst-1",
      name: "Beta Assistant",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      projects: mockProjects as any,
      assistants: mockAssistants as any,
      loadSkills: vi.fn(),
    });
  });

  const baseSkill: Skill = {
    id: "sk-1",
    userId: "u1",
    name: "test-skill",
    displayName: "Test Skill",
    description: "A skill for testing",
    content: "Instructions",
    files: [],
    enabled: true,
    projectId: null,
    assistantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("renders global badge when skill has no projectId or assistantId", () => {
    render(<SkillCard skill={baseSkill} />);

    expect(screen.getByText("Test Skill")).toBeInTheDocument();
    expect(screen.getByText("/test-skill")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("renders project badge when skill has projectId", () => {
    const projectSkill: Skill = {
      ...baseSkill,
      id: "sk-2",
      name: "project-skill",
      displayName: "Project Skill",
      projectId: "proj-1",
    };

    render(<SkillCard skill={projectSkill} />);

    expect(screen.getByText("Project Skill")).toBeInTheDocument();
    expect(screen.getByText("/project-skill")).toBeInTheDocument();
    expect(screen.getByText("Project: Alpha Project")).toBeInTheDocument();
  });

  it("renders assistant badge when skill has assistantId", () => {
    const assistantSkill: Skill = {
      ...baseSkill,
      id: "sk-3",
      name: "asst-skill",
      displayName: "Assistant Skill",
      assistantId: "asst-1",
    };

    render(<SkillCard skill={assistantSkill} />);

    expect(screen.getByText("Assistant Skill")).toBeInTheDocument();
    expect(screen.getByText("/asst-skill")).toBeInTheDocument();
    expect(screen.getByText("Assistant: Beta Assistant")).toBeInTheDocument();
  });

  it("toggles skill enabled state", async () => {
    const user = userEvent.setup();
    mockToggleSkillEnabled.mockResolvedValueOnce({ ok: true });

    render(<SkillCard skill={baseSkill} />);

    const toggle = screen.getByRole("switch", { name: /toggle skill/i });
    await user.click(toggle);

    await waitFor(() => {
      expect(mockToggleSkillEnabled).toHaveBeenCalledWith("sk-1", false);
    });
  });

  it("opens delete dialog and deletes skill", async () => {
    const user = userEvent.setup();
    mockDeleteSkill.mockResolvedValueOnce({ ok: true });

    render(<SkillCard skill={baseSkill} />);

    const deleteBtn = screen.getByLabelText("Delete skill");
    await user.click(deleteBtn);

    expect(
      screen.getByText(
        'Are you sure you want to delete "Test Skill"? This action cannot be undone.',
      ),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteSkill).toHaveBeenCalledWith("sk-1");
    });
  });
});
