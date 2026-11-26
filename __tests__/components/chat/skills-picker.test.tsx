import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SkillsPicker,
  SkillsPickerDialog,
} from "@/components/chat/skills-picker";
import type { Skill } from "@/types/skill/skill";

// Mock env
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

const mockSkills: Skill[] = [
  {
    id: "s1",
    name: "ai-sdk-nextjs",
    displayName: "AI SDK Nextjs",
    description: "Use when building AI chat in Next.js",
    content: "Instructions",
    files: [],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "s2",
    name: "design-patterns",
    displayName: "Design Patterns",
    description: "Software design patterns",
    content: "Instructions",
    files: [],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("SkillsPicker", () => {
  it("renders enabled skills with display name and slug", () => {
    render(
      <SkillsPicker
        skills={mockSkills}
        selectedIds={new Set()}
        onToggleSkill={vi.fn()}
      />,
    );

    expect(screen.getByText("AI SDK Nextjs")).toBeDefined();
    expect(screen.getByText("/ai-sdk-nextjs")).toBeDefined();
    expect(screen.getByText("Design Patterns")).toBeDefined();
    expect(screen.getByText("/design-patterns")).toBeDefined();
    expect(screen.getByText("2 skills available")).toBeDefined();
  });

  it("filters skills by search keyword", () => {
    render(
      <SkillsPicker
        skills={mockSkills}
        selectedIds={new Set()}
        onToggleSkill={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search skills...");
    fireEvent.change(searchInput, { target: { value: "design" } });

    expect(screen.queryByText("AI SDK Nextjs")).toBeNull();
    expect(screen.getByText("Design Patterns")).toBeDefined();
    expect(screen.getByText("1 skill available")).toBeDefined();
  });

  it("toggles all skills with Select All button", () => {
    const handleSelectSkills = vi.fn();
    render(
      <SkillsPicker
        skills={mockSkills}
        selectedIds={new Set()}
        onToggleSkill={vi.fn()}
        onSelectSkills={handleSelectSkills}
      />,
    );

    const selectAllBtn = screen.getByText("Select All");
    fireEvent.click(selectAllBtn);

    expect(handleSelectSkills).toHaveBeenCalledWith(new Set(["s1", "s2"]));
  });
});

describe("SkillsPickerDialog", () => {
  it("renders empty state when there are no skills", () => {
    render(
      <SkillsPickerDialog
        skills={[]}
        selectedIds={new Set()}
        onToggleSkill={vi.fn()}
        trigger={<button type="button">Open</button>}
      />,
    );

    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("No skills configured yet.")).toBeDefined();
  });

  it("renders skills dialog with Manage Skills link and selection count", () => {
    render(
      <SkillsPickerDialog
        skills={mockSkills}
        selectedSkills={new Set(["s1"])}
        onToggleSkill={vi.fn()}
        trigger={<button type="button">Open</button>}
      />,
    );

    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("Select Agent Skills")).toBeDefined();
    expect(screen.getByText("Manage Skills")).toBeDefined();
    expect(
      screen.getByText((_content, element) => {
        return element?.textContent === "1/2 selected skills";
      }),
    ).toBeDefined();
  });

  it("handles deselect all, onToggleSkill fallback, checkbox click, empty state, and default dialog trigger", () => {
    const onToggleSkill = vi.fn();
    const onSelectSkills = vi.fn();
    const skills = [
      { id: "sk-1", name: "alpha", displayName: "Alpha", description: "First", enabled: true },
      { id: "sk-2", name: "beta", displayName: "", description: "Second", enabled: true },
    ] as any[];

    const { rerender } = render(
      <SkillsPicker
        skills={skills}
        selectedIds={new Set(["sk-1", "sk-2"])}
        onToggleSkill={onToggleSkill}
        onSelectSkills={onSelectSkills}
        maxHeight="200px"
      />,
    );

    fireEvent.click(screen.getByText("Deselect All"));
    expect(onSelectSkills).toHaveBeenCalledWith(new Set());

    // Fallback without onSelectSkills: select unselected
    rerender(
      <SkillsPicker
        skills={skills}
        selectedIds={new Set(["sk-1"])}
        onToggleSkill={onToggleSkill}
      />,
    );
    fireEvent.click(screen.getByText("Select All"));
    expect(onToggleSkill).toHaveBeenCalledWith("sk-2");

    // Fallback without onSelectSkills: deselect all
    onToggleSkill.mockClear();
    rerender(
      <SkillsPicker
        skills={skills}
        selectedIds={new Set(["sk-1", "sk-2"])}
        onToggleSkill={onToggleSkill}
      />,
    );
    fireEvent.click(screen.getByText("Deselect All"));
    expect(onToggleSkill).toHaveBeenCalledTimes(2);

    // Checkbox click
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    expect(onToggleSkill).toHaveBeenCalled();

    // Empty state
    rerender(
      <SkillsPicker
        skills={[]}
        selectedIds={new Set()}
        onToggleSkill={onToggleSkill}
        maxHeight="300px"
      />,
    );
    expect(screen.getByText("No skills found.")).toBeDefined();

    // Default dialog trigger
    render(
      <SkillsPickerDialog
        skills={skills}
        selectedSkills={new Set()}
        onToggleSkill={onToggleSkill}
      />,
    );
    expect(screen.getByRole("button", { name: "Select Skills" })).toBeDefined();
  });
});
