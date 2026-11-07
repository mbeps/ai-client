import { describe, expect, it } from "vitest";
import {
  createPromptSchema,
  promptIdsSchema,
  promptModeSchema,
  promptSchema,
  updatePromptSchema,
} from "@/schemas/prompt/prompt";

// createPromptSchema
describe("createPromptSchema", () => {
  it("accepts valid data", () => {
    const result = createPromptSchema.safeParse({
      title: "My Prompt",
      content: "You are a helpful assistant.",
      shortcut: "helper",
    });
    expect(result.success).toBe(true);
  });

  it("accepts shortcut with dots, underscores, and hyphens", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "Content",
      shortcut: "my.shortcut_1-a",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createPromptSchema.safeParse({
      title: "",
      content: "Content",
      shortcut: "shortcut",
    });
    expect(result.success).toBe(false);
  });

  it("rejects title longer than 100 characters", () => {
    const result = createPromptSchema.safeParse({
      title: "t".repeat(101),
      content: "Content",
      shortcut: "shortcut",
    });
    expect(result.success).toBe(false);
  });

  it("accepts title exactly 100 characters", () => {
    const result = createPromptSchema.safeParse({
      title: "t".repeat(100),
      content: "Content",
      shortcut: "shortcut",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "",
      shortcut: "shortcut",
    });
    expect(result.success).toBe(false);
  });

  it("rejects content longer than 10 000 characters", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "c".repeat(10001),
      shortcut: "shortcut",
    });
    expect(result.success).toBe(false);
  });

  it("accepts content exactly 10 000 characters", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "c".repeat(10000),
      shortcut: "shortcut",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty shortcut", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "Content",
      shortcut: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects shortcut longer than 50 characters", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "Content",
      shortcut: "a".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects shortcut with spaces", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "Content",
      shortcut: "my shortcut",
    });
    expect(result.success).toBe(false);
  });

  it("rejects shortcut with special chars like @", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "Content",
      shortcut: "my@shortcut",
    });
    expect(result.success).toBe(false);
  });

  it("rejects shortcut with forward slash", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "Content",
      shortcut: "my/shortcut",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid projectId", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "Content",
      shortcut: "shortcut",
      projectId: "proj-123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid assistantId", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "Content",
      shortcut: "shortcut",
      assistantId: "asst-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects both projectId and assistantId provided together", () => {
    const result = createPromptSchema.safeParse({
      title: "Title",
      content: "Content",
      shortcut: "shortcut",
      projectId: "proj-123",
      assistantId: "asst-123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "A prompt cannot be scoped to both a project and an assistant",
      );
    }
  });
});

// updatePromptSchema
describe("updatePromptSchema", () => {
  it("accepts empty object — all fields optional", () => {
    const result = updatePromptSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts only title update", () => {
    const result = updatePromptSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  it("accepts only shortcut update", () => {
    const result = updatePromptSchema.safeParse({ shortcut: "new-shortcut" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid shortcut when provided", () => {
    const result = updatePromptSchema.safeParse({ shortcut: "bad shortcut!" });
    expect(result.success).toBe(false);
  });

  it("accepts updating projectId and assistantId individually", () => {
    expect(
      updatePromptSchema.safeParse({ projectId: "proj-1" }).success,
    ).toBe(true);
    expect(
      updatePromptSchema.safeParse({ assistantId: "asst-1" }).success,
    ).toBe(true);
    expect(
      updatePromptSchema.safeParse({ projectId: null, assistantId: null }).success,
    ).toBe(true);
  });

  it("rejects updating both projectId and assistantId together", () => {
    const result = updatePromptSchema.safeParse({
      projectId: "proj-1",
      assistantId: "asst-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("promptSchema, promptModeSchema, promptIdsSchema", () => {
  it("validates promptModeSchema with defaults", () => {
    expect(promptModeSchema.parse(undefined)).toBe("all");
    expect(promptModeSchema.parse("none")).toBe("none");
    expect(promptModeSchema.parse("specific")).toBe("specific");
    expect(promptModeSchema.safeParse("invalid").success).toBe(false);
  });

  it("validates promptIdsSchema with defaults", () => {
    expect(promptIdsSchema.parse(undefined)).toEqual([]);
    expect(promptIdsSchema.parse(["p-1", "p-2"])).toEqual(["p-1", "p-2"]);
    expect(promptIdsSchema.safeParse("not-an-array").success).toBe(false);
  });

  it("validates promptSchema full object", () => {
    const validPrompt = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      userId: "user-1",
      title: "Title",
      shortcut: "shortcut",
      content: "Content",
      projectId: "proj-1",
      assistantId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(promptSchema.safeParse(validPrompt).success).toBe(true);
  });
});
