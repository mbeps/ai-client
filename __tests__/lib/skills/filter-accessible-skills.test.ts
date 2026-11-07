import { describe, expect, it } from "vitest";
import { filterAccessibleSkills } from "@/lib/skills/filter-accessible-skills";
import type { Skill } from "@/types/skill/skill";

describe("filterAccessibleSkills", () => {
  const mockSkills: Skill[] = [
    {
      id: "s-global-1",
      userId: "u1",
      name: "global-clean-code",
      displayName: "Clean Code",
      description: "Pragmatic code quality.",
      content: "Content",
      files: [],
      enabled: true,
      projectId: null,
      assistantId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "s-global-2",
      userId: "u1",
      name: "global-testing",
      displayName: "Testing",
      description: "TDD best practices.",
      content: "Content",
      files: [],
      enabled: true,
      projectId: null,
      assistantId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "s-proj-1",
      userId: "u1",
      name: "proj-1-skill",
      displayName: "Project One Skill",
      description: "Desc",
      content: "Content",
      files: [],
      enabled: true,
      projectId: "proj-1",
      assistantId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "s-proj-2",
      userId: "u1",
      name: "proj-2-skill",
      displayName: "Project Two Skill",
      description: "Desc",
      content: "Content",
      files: [],
      enabled: true,
      projectId: "proj-2",
      assistantId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "s-asst-1",
      userId: "u1",
      name: "asst-1-skill",
      displayName: "Assistant One Skill",
      description: "Desc",
      content: "Content",
      files: [],
      enabled: true,
      projectId: null,
      assistantId: "asst-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "s-disabled",
      userId: "u1",
      name: "disabled-skill",
      displayName: "Disabled Skill",
      description: "Desc",
      content: "Content",
      files: [],
      enabled: false,
      projectId: null,
      assistantId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("returns only global enabled skills for default/empty context", () => {
    const result = filterAccessibleSkills(mockSkills);
    expect(result.map((s) => s.id)).toEqual(["s-global-1", "s-global-2"]);
  });

  it("returns empty array when skillMode is none", () => {
    const result = filterAccessibleSkills(mockSkills, {
      projectId: "proj-1",
      skillMode: "none",
    });
    expect(result).toEqual([]);
  });

  it("returns project skills plus all global skills when in project with dynamic mode", () => {
    const result = filterAccessibleSkills(mockSkills, {
      projectId: "proj-1",
      skillMode: "dynamic",
    });
    expect(result.map((s) => s.id)).toEqual([
      "s-global-1",
      "s-global-2",
      "s-proj-1",
    ]);
  });

  it("returns project skills plus specified global skills when in project with specific mode", () => {
    const result = filterAccessibleSkills(mockSkills, {
      projectId: "proj-1",
      skillMode: "specific",
      skillIds: ["s-global-1"],
    });
    expect(result.map((s) => s.id)).toEqual(["s-global-1", "s-proj-1"]);
  });

  it("returns assistant skills plus all global skills when in assistant with dynamic mode", () => {
    const result = filterAccessibleSkills(mockSkills, {
      assistantId: "asst-1",
      skillMode: "dynamic",
    });
    expect(result.map((s) => s.id)).toEqual([
      "s-global-1",
      "s-global-2",
      "s-asst-1",
    ]);
  });

  it("returns assistant skills plus specified global skills when in assistant with specific mode", () => {
    const result = filterAccessibleSkills(mockSkills, {
      assistantId: "asst-1",
      skillMode: "specific",
      skillIds: ["s-global-2"],
    });
    expect(result.map((s) => s.id)).toEqual(["s-global-2", "s-asst-1"]);
  });

  it("matches skillIds by name or id", () => {
    const result = filterAccessibleSkills(mockSkills, {
      projectId: "proj-1",
      skillMode: "specific",
      skillIds: ["global-clean-code"],
    });
    expect(result.map((s) => s.id)).toEqual(["s-global-1", "s-proj-1"]);
  });
});
