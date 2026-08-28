import { describe, it, expect } from "vitest";
import {
  createSkillSchema,
  updateSkillSchema,
  skillSchema,
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

  it("rejects description longer than 1024 characters", () => {
    const result = createSkillSchema.safeParse({
      name: "my-skill",
      displayName: "Display",
      description: "d".repeat(1025),
      content: "Content",
    });
    expect(result.success).toBe(false);
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
});

describe("updateSkillSchema", () => {
  it("accepts partial updates", () => {
    const result = updateSkillSchema.safeParse({
      displayName: "Updated Name",
      enabled: false,
    });
    expect(result.success).toBe(true);
  });

  it("validates slug if name is provided in update", () => {
    const invalid = updateSkillSchema.safeParse({
      name: "Invalid Slug",
    });
    expect(invalid.success).toBe(false);
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });
});
