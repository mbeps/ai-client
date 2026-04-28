import { describe, it, expect } from "vitest";
import {
  createPromptSchema,
  updatePromptSchema,
  renamePromptSchema,
} from "@/schemas/prompt";

// ---------------------------------------------------------------------------
// createPromptSchema
// ---------------------------------------------------------------------------
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
});

// ---------------------------------------------------------------------------
// updatePromptSchema
// ---------------------------------------------------------------------------
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
});

// ---------------------------------------------------------------------------
// renamePromptSchema
// ---------------------------------------------------------------------------
describe("renamePromptSchema", () => {
  it("accepts valid title", () => {
    const result = renamePromptSchema.safeParse({ title: "Renamed Prompt" });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = renamePromptSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title longer than 100 characters", () => {
    const result = renamePromptSchema.safeParse({ title: "t".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects missing title field", () => {
    const result = renamePromptSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
