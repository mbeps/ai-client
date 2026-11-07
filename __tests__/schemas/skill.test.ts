import { describe, expect, it } from "vitest";
import {
  createSkillSchema,
  skillSchema,
  updateSkillSchema,
} from "@/schemas/skill/skill";

describe("createSkillSchema", () => {
  it("accepts valid skill data", () => {
    const result = createSkillSchema.safeParse({
      name: "clean-code",
      displayName: "Clean Code",
      description: "Pragmatic coding standards - concise and direct.",
      content: "# Clean Code\nFollow simple patterns.",
      files: [{ path: "references/guide.md", content: "Guidelines here" }],
      enabled: true,
    });
    expect(result.success).toBe(true);
  });

  it("defaults files to empty array and enabled to true", () => {
    const result = createSkillSchema.safeParse({
      name: "frontend-design",
      displayName: "Frontend Design",
      description: "UI/UX best practices.",
      content: "Design beautiful interfaces.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files).toEqual([]);
      expect(result.data.enabled).toBe(true);
    }
  });

  it("rejects invalid skill slug name with uppercase or spaces", () => {
    const invalidNames = [
      "CleanCode",
      "clean code",
      "clean_code",
      "clean.code",
      "clean@code",
      "",
    ];
    for (const name of invalidNames) {
      const result = createSkillSchema.safeParse({
        name,
        displayName: "Clean Code",
        description: "Description",
        content: "Content",
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects slug longer than 64 characters", () => {
    const result = createSkillSchema.safeParse({
      name: "a".repeat(65),
      displayName: "Display",
      description: "Description",
      content: "Content",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 500 characters", () => {
    const valid = createSkillSchema.safeParse({
      name: "my-skill",
      displayName: "Display",
      description: "d".repeat(500),
      content: "Content",
    });
    expect(valid.success).toBe(true);

    const invalid = createSkillSchema.safeParse({
      name: "my-skill",
      displayName: "Display",
      description: "d".repeat(501),
      content: "Content",
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects empty displayName or content", () => {
    const emptyDisplayName = createSkillSchema.safeParse({
      name: "my-skill",
      displayName: "",
      description: "Desc",
      content: "Content",
    });
    expect(emptyDisplayName.success).toBe(false);

    const emptyContent = createSkillSchema.safeParse({
      name: "my-skill",
      displayName: "Name",
      description: "Desc",
      content: "",
    });
    expect(emptyContent.success).toBe(false);
  });

  it("accepts optional projectId or assistantId", () => {
    const withProject = createSkillSchema.safeParse({
      name: "proj-skill",
      displayName: "Project Skill",
      description: "Desc",
      content: "Content",
      projectId: "proj-1",
    });
    expect(withProject.success).toBe(true);

    const withAssistant = createSkillSchema.safeParse({
      name: "asst-skill",
      displayName: "Assistant Skill",
      description: "Desc",
      content: "Content",
      assistantId: "asst-1",
    });
    expect(withAssistant.success).toBe(true);
  });

  it("rejects when both projectId and assistantId are provided", () => {
    const dual = createSkillSchema.safeParse({
      name: "dual-skill",
      displayName: "Dual Skill",
      description: "Desc",
      content: "Content",
      projectId: "proj-1",
      assistantId: "asst-1",
    });
    expect(dual.success).toBe(false);
    if (!dual.success) {
      expect(dual.error.issues[0].message).toContain(
        "A skill cannot be scoped to both a project and an assistant",
      );
    }
  });
});

describe("updateSkillSchema", () => {
  it("accepts partial updates", () => {
    const result = updateSkillSchema.safeParse({
      displayName: "Updated Name",
      enabled: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts updating projectId or assistantId", () => {
    const updateProj = updateSkillSchema.safeParse({
      projectId: "proj-2",
    });
    expect(updateProj.success).toBe(true);

    const updateAsst = updateSkillSchema.safeParse({
      assistantId: "asst-2",
    });
    expect(updateAsst.success).toBe(true);
  });

  it("rejects update when both projectId and assistantId are provided", () => {
    const dual = updateSkillSchema.safeParse({
      projectId: "proj-1",
      assistantId: "asst-1",
    });
    expect(dual.success).toBe(false);
  });

  it("validates slug if name is provided in update", () => {
    const invalid = updateSkillSchema.safeParse({
      name: "Invalid Slug",
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects description longer than 500 characters in update", () => {
    const invalid = updateSkillSchema.safeParse({
      description: "d".repeat(501),
    });
    expect(invalid.success).toBe(false);

    const valid = updateSkillSchema.safeParse({
      description: "d".repeat(500),
    });
    expect(valid.success).toBe(true);
  });
});

describe("skillSchema", () => {
  it("validates full stored skill object", () => {
    const result = skillSchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174000",
      userId: "user-123",
      name: "clean-code",
      displayName: "Clean Code",
      description: "Standards.",
      content: "# Content",
      files: [],
      enabled: true,
      projectId: "proj-1",
      assistantId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });
});
