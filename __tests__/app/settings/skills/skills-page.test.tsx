import { render, screen } from "@testing-library/react";
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
    description: "Write plans",
    content: "content",
    files: [],
    enabled: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-03-01"), // Most recently updated
  },
  {
    id: "skill-1",
    userId: "user-1",
    name: "brainstorming",
    displayName: "Brainstorming",
    description: "Brainstorming",
    content: "content",
    files: [],
    enabled: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"), // Oldest
  },
  {
    id: "skill-2",
    userId: "user-1",
    name: "karpathy-guidelines",
    displayName: "Karpathy Guidelines",
    description: "Guidelines",
    content: "content",
    files: [],
    enabled: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-02-01"), // Middle
  },
];

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      skills: mockSkills,
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
});

