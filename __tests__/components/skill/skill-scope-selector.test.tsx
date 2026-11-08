import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillScopeSelector } from "@/components/skill/skill-scope-selector";
import { useAppStore } from "@/lib/store/use-app-store";

describe("SkillScopeSelector", () => {
  const mockProjects = [
    {
      id: "proj-1",
      userId: "u1",
      name: "Alpha Project",
      description: "Description",
      globalPrompt: "",
      tools: [],
      skillMode: "dynamic" as const,
      skillIds: [],
      promptMode: "all" as const,
      promptIds: [],
      knowledgebaseId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockAssistants = [
    {
      id: "asst-1",
      userId: "u1",
      name: "Beta Assistant",
      description: "Description",
      prompt: "",
      tools: [],
      skillMode: "dynamic" as const,
      skillIds: [],
      promptMode: "all" as const,
      promptIds: [],
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    useAppStore.setState({
      projects: mockProjects,
      assistants: mockAssistants,
    });
  });

  it("renders with global scope active by default", () => {
    render(
      <SkillScopeSelector
        scope="global"
        onScopeChange={vi.fn()}
        onProjectIdChange={vi.fn()}
        onAssistantIdChange={vi.fn()}
      />,
    );

    const globalRadio = screen.getByRole("radio", { name: /global/i });
    expect(globalRadio).toBeInTheDocument();
    expect(globalRadio).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText("Where this agent skill can be invoked."),
    ).toBeInTheDocument();
  });

  it("calls onScopeChange when clicking project or assistant card", async () => {
    const user = userEvent.setup();
    const onScopeChange = vi.fn();
    const onProjectIdChange = vi.fn();
    const onAssistantIdChange = vi.fn();

    render(
      <SkillScopeSelector
        scope="global"
        onScopeChange={onScopeChange}
        onProjectIdChange={onProjectIdChange}
        onAssistantIdChange={onAssistantIdChange}
      />,
    );

    const projectRadio = screen.getByRole("radio", { name: /project/i });
    await user.click(projectRadio);
    expect(onScopeChange).toHaveBeenCalledWith("project");

    const assistantRadio = screen.getByRole("radio", { name: /assistant/i });
    await user.click(assistantRadio);
    expect(onScopeChange).toHaveBeenCalledWith("assistant");
  });

  it("clears projectId and assistantId when switching to global scope", async () => {
    const user = userEvent.setup();
    const onScopeChange = vi.fn();
    const onProjectIdChange = vi.fn();
    const onAssistantIdChange = vi.fn();

    render(
      <SkillScopeSelector
        scope="project"
        projectId="proj-1"
        onScopeChange={onScopeChange}
        onProjectIdChange={onProjectIdChange}
        onAssistantIdChange={onAssistantIdChange}
      />,
    );

    const globalRadio = screen.getByRole("radio", { name: /global/i });
    await user.click(globalRadio);
    expect(onScopeChange).toHaveBeenCalledWith("global");
    expect(onProjectIdChange).toHaveBeenCalledWith(null);
    expect(onAssistantIdChange).toHaveBeenCalledWith(null);
  });

  it("renders project dropdown when project scope is active", () => {
    render(
      <SkillScopeSelector
        scope="project"
        projectId="proj-1"
        onScopeChange={vi.fn()}
        onProjectIdChange={vi.fn()}
        onAssistantIdChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
  });

  it("renders assistant dropdown when assistant scope is active", () => {
    render(
      <SkillScopeSelector
        scope="assistant"
        assistantId="asst-1"
        onScopeChange={vi.fn()}
        onProjectIdChange={vi.fn()}
        onAssistantIdChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Beta Assistant")).toBeInTheDocument();
  });
});
