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
      agents: mockAssistants as any,
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
    projectIds: [],
    assistantIds: [],
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
      projectIds: ["proj-1"],
      assistantIds: [],
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
      projectIds: [],
      assistantIds: ["asst-1"],
    };

    render(<SkillCard skill={assistantSkill} />);

    expect(screen.getByText("Assistant Skill")).toBeInTheDocument();
    expect(screen.getByText("Agent: Beta Assistant")).toBeInTheDocument();
  });

  it("renders multiple project and assistant badges when scoped to both", () => {
    const multiSkill: Skill = {
      ...baseSkill,
      id: "sk-4",
      name: "multi-skill",
      displayName: "Multi Skill",
      projectIds: ["proj-1", "proj-2"],
      assistantIds: ["asst-1", "asst-2"],
    };

    render(<SkillCard skill={multiSkill} />);

    expect(screen.getByText("Multi Skill")).toBeInTheDocument();
    expect(screen.getByText("2 Proj, 2 Agent")).toBeInTheDocument();
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

  it("handles toggle and delete error responses, exceptions, and fallback labels", async () => {
    const { fireEvent } = await import("@testing-library/react");
    mockToggleSkillEnabled
      .mockResolvedValueOnce({ ok: false, error: { message: "Toggle err" } })
      .mockResolvedValueOnce({ ok: false, error: { message: "" } })
      .mockRejectedValueOnce(new Error("Toggle boom"))
      .mockRejectedValueOnce({});

    render(
      <SkillCard
        skill={{
          ...baseSkill,
          description: "",
          projectIds: ["unknown-proj"],
          assistantIds: [],
        }}
      />,
    );

    const toggle = screen.getByRole("switch", { name: /toggle skill/i });
    fireEvent.click(toggle);
    await waitFor(() => expect(mockToggleSkillEnabled).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle);
    await waitFor(() => expect(mockToggleSkillEnabled).toHaveBeenCalledTimes(2));
    fireEvent.click(toggle);
    await waitFor(() => expect(mockToggleSkillEnabled).toHaveBeenCalledTimes(3));
    fireEvent.click(toggle);
    await waitFor(() => expect(mockToggleSkillEnabled).toHaveBeenCalledTimes(4));

    mockDeleteSkill
      .mockResolvedValueOnce({ ok: false, error: { message: "Del err" } })
      .mockResolvedValueOnce({ ok: false, error: { message: "" } })
      .mockRejectedValueOnce(new Error("Del boom"))
      .mockRejectedValueOnce({});

    const triggerDelete = async (count: number) => {
      fireEvent.click(screen.getByLabelText("Delete skill"));
      fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
      await waitFor(() => expect(mockDeleteSkill).toHaveBeenCalledTimes(count));
    };

    await triggerDelete(1);
    await triggerDelete(2);
    await triggerDelete(3);
    await triggerDelete(4);

    mockToggleSkillEnabled.mockResolvedValueOnce({ ok: true, value: {} });
    render(
      <SkillCard
        skill={{
          ...baseSkill,
          id: "sk-disabled-files",
          enabled: false,
          files: [
            { id: "f1", path: "a.md", size: 10, updatedAt: new Date() },
            { id: "f2", path: "b.md", size: 20, updatedAt: new Date() },
          ] as any,
        }}
      />,
    );
    expect(screen.getByText("2 files")).toBeInTheDocument();
    const toggles = screen.getAllByRole("switch", { name: /toggle skill/i });
    fireEvent.click(toggles[toggles.length - 1]);
    await waitFor(() => expect(mockToggleSkillEnabled).toHaveBeenCalledTimes(5));

    render(
      <SkillCard
        skill={{
          ...baseSkill,
          id: "sk-unknown-asst",
          projectIds: [],
          assistantIds: ["unknown-asst"],
        }}
      />,
    );
    expect(screen.getByText("Agent: Agent")).toBeInTheDocument();

    render(
      <SkillCard
        skill={{
          ...baseSkill,
          id: "sk-multi-proj",
          projectIds: ["p1", "p2"],
          assistantIds: [],
          description: "",
        }}
      />,
    );
    expect(screen.getByText("2 Projects")).toBeInTheDocument();

    render(
      <SkillCard
        skill={{
          ...baseSkill,
          id: "sk-multi-asst",
          projectIds: [],
          assistantIds: ["a1", "a2"],
        }}
      />,
    );
    expect(screen.getByText("2 Agents")).toBeInTheDocument();
  });
});
