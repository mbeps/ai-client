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
      agents: mockAssistants,
    });
  });

  it("renders with global scope active by default", () => {
    render(
      <SkillScopeSelector
        projectIds={[]}
        assistantIds={[]}
        onProjectIdsChange={vi.fn()}
        onAssistantIdsChange={vi.fn()}
      />,
    );

    const globalRadio = screen.getByRole("radio", { name: /global/i });
    expect(globalRadio).toBeInTheDocument();
    expect(globalRadio).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText("Control where this resource can be invoked."),
    ).toBeInTheDocument();
  });

  it("calls onProjectIdsChange and onAssistantIdsChange when cleared", async () => {
    const user = userEvent.setup();
    const onProjectIdsChange = vi.fn();
    const onAssistantIdsChange = vi.fn();

    render(
      <SkillScopeSelector
        projectIds={["proj-1"]}
        assistantIds={["asst-1"]}
        onProjectIdsChange={onProjectIdsChange}
        onAssistantIdsChange={onAssistantIdsChange}
      />,
    );

    const globalRadio = screen.getByRole("radio", { name: /global/i });
    await user.click(globalRadio);

    expect(onProjectIdsChange).toHaveBeenCalledWith([]);
    expect(onAssistantIdsChange).toHaveBeenCalledWith([]);
  });

  it("renders selected project badge when projectIds is populated", () => {
    render(
      <SkillScopeSelector
        projectIds={["proj-1"]}
        assistantIds={[]}
        onProjectIdsChange={vi.fn()}
        onAssistantIdsChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
  });

  it("renders selected assistant badge when assistantIds is populated", () => {
    render(
      <SkillScopeSelector
        projectIds={[]}
        assistantIds={["asst-1"]}
        onProjectIdsChange={vi.fn()}
        onAssistantIdsChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Beta Assistant")).toBeInTheDocument();
  });
});
