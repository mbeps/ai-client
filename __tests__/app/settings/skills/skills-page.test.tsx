import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SkillsPage from "@/app/settings/skills/page";
import type { Skill } from "@/types/skill/skill";

const mockLoadSkills = vi.fn();

const mockSkills: Skill[] = [
  {
    id: "skill-3",
    userId: "user-1",
    name: "writing-plans",
    displayName: "Writing Plans",
    description: "Write structured plans",
    content: "content",
    files: [],
    enabled: false,
    projectIds: ["proj-1"],
    assistantIds: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-03-01"), // Most recently updated
  },
  {
    id: "skill-1",
    userId: "user-1",
    name: "brainstorming",
    displayName: "Brainstorming",
    description: "Brainstorm solutions",
    content: "content",
    files: [],
    enabled: true,
    projectIds: [],
    assistantIds: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"), // Oldest
  },
  {
    id: "skill-2",
    userId: "user-1",
    name: "karpathy-guidelines",
    displayName: "Karpathy Guidelines",
    description: "Engineering rules",
    content: "content",
    files: [],
    enabled: false,
    projectIds: [],
    assistantIds: ["asst-1"],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-02-01"), // Middle
  },
];

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      skills: mockSkills,
      projects: [{ id: "proj-1", name: "Alpha Project" }],
      assistants: [{ id: "asst-1", name: "Beta Assistant" }],
      loadSkills: mockLoadSkills,
      loadError: null,
    }),
}));

describe("SkillsPage", () => {
  it("renders skills in alphabetical order by name regardless of updatedAt recency", () => {
    const { container } = render(<SkillsPage />);

    expect(screen.getByText("Agent Skills")).toBeInTheDocument();
    expect(mockLoadSkills).toHaveBeenCalled();

    const skillHeadings = container.querySelectorAll("h3");
    const names = Array.from(skillHeadings).map((h) => h.textContent);

    expect(names).toEqual([
      "Brainstorming",
      "Karpathy Guidelines",
      "Writing Plans",
    ]);
  });

  it("filters skills when scope filter buttons are clicked", async () => {
    const user = userEvent.setup();
    render(<SkillsPage />);

    const globalFilterBtn = screen.getByRole("button", { name: "Global" });
    await user.click(globalFilterBtn);

    expect(screen.getByText("Brainstorming")).toBeInTheDocument();
    expect(screen.queryByText("Karpathy Guidelines")).not.toBeInTheDocument();
    expect(screen.queryByText("Writing Plans")).not.toBeInTheDocument();

    const projectsFilterBtn = screen.getByRole("button", { name: "Projects" });
    await user.click(projectsFilterBtn);

    expect(screen.getByText("Writing Plans")).toBeInTheDocument();
    expect(screen.queryByText("Brainstorming")).not.toBeInTheDocument();

    const assistantsFilterBtn = screen.getByRole("button", { name: "Assistants" });
    await user.click(assistantsFilterBtn);

    expect(screen.getByText("Karpathy Guidelines")).toBeInTheDocument();
    expect(screen.queryByText("Brainstorming")).not.toBeInTheDocument();

    const allFilterBtn = screen.getByRole("button", { name: "All" });
    await user.click(allFilterBtn);

    expect(screen.getByText("Brainstorming")).toBeInTheDocument();
    expect(screen.getByText("Karpathy Guidelines")).toBeInTheDocument();
    expect(screen.getByText("Writing Plans")).toBeInTheDocument();
  });
});

