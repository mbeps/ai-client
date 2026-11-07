import { describe, expect, it } from "vitest";
import {
  assistantSchema,
  createAssistantSchema,
  renameAssistantSchema,
  updateAssistantSchema,
} from "@/schemas/assistant/assistant";

// ---------------------------------------------------------------------------
// createAssistantSchema
// ---------------------------------------------------------------------------
describe("createAssistantSchema", () => {
  it("accepts valid minimal data (name only)", () => {
    const result = createAssistantSchema.safeParse({ name: "My Assistant" });
    expect(result.success).toBe(true);
  });

  it("accepts valid full data", () => {
    const result = createAssistantSchema.safeParse({
      name: "My Assistant",
      description: "A helpful assistant",
      prompt: "You are helpful.",
      avatar: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null avatar", () => {
    const result = createAssistantSchema.safeParse({
      name: "My Assistant",
      avatar: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createAssistantSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid promptMode and promptIds updates", () => {
    const result = updateAssistantSchema.safeParse({
      promptMode: "none",
      promptIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createAssistantSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 500 characters", () => {
    const result = createAssistantSchema.safeParse({
      name: "Valid",
      description: "d".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid promptMode and promptIds", () => {
    const result = createAssistantSchema.safeParse({
      name: "Valid",
      promptMode: "specific",
      promptIds: ["prompt-1"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects prompt longer than 10 000 characters", () => {
    const result = createAssistantSchema.safeParse({
      name: "Valid",
      prompt: "p".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid avatar URL", () => {
    const result = createAssistantSchema.safeParse({
      name: "Valid",
      avatar: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects avatar URL longer than 1024 characters", () => {
    const result = createAssistantSchema.safeParse({
      name: "Valid",
      avatar: `https://example.com/${"a".repeat(1020)}`,
    });
    expect(result.success).toBe(false);
  });

  it("accepts name exactly 100 characters", () => {
    const result = createAssistantSchema.safeParse({ name: "a".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("accepts prompt exactly 10 000 characters", () => {
    const result = createAssistantSchema.safeParse({
      name: "Valid",
      prompt: "p".repeat(10000),
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateAssistantSchema
// ---------------------------------------------------------------------------
describe("updateAssistantSchema", () => {
  it("accepts empty object (all optional)", () => {
    const result = updateAssistantSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only name", () => {
    const result = updateAssistantSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only prompt", () => {
    const result = updateAssistantSchema.safeParse({ prompt: "New prompt." });
    expect(result.success).toBe(true);
  });

  it("accepts valid promptMode and promptIds updates", () => {
    const result = updateAssistantSchema.safeParse({
      promptMode: "none",
      promptIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects name longer than 100 characters", () => {
    const result = updateAssistantSchema.safeParse({ name: "n".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid avatar URL", () => {
    const result = updateAssistantSchema.safeParse({ avatar: "bad-url" });
    expect(result.success).toBe(false);
  });

  it("accepts null avatar", () => {
    const result = updateAssistantSchema.safeParse({ avatar: null });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renameAssistantSchema
// ---------------------------------------------------------------------------
describe("renameAssistantSchema", () => {
  it("accepts valid name", () => {
    const result = renameAssistantSchema.safeParse({ name: "Renamed" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = renameAssistantSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid promptMode and promptIds updates", () => {
    const result = updateAssistantSchema.safeParse({
      promptMode: "none",
      promptIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects name longer than 100 characters", () => {
    const result = renameAssistantSchema.safeParse({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects missing name field", () => {
    const result = renameAssistantSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("assistantSchema", () => {
  it("validates full assistant object", () => {
    const result = assistantSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      userId: "user-1",
      name: "Assistant",
      description: "Description",
      prompt: "Prompt",
      tools: [],
      skillMode: "dynamic",
      skillIds: [],
      promptMode: "all",
      promptIds: [],
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });
});
