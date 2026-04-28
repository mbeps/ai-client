import { describe, it, expect } from "vitest";
import {
  createAssistantSchema,
  updateAssistantSchema,
  renameAssistantSchema,
} from "@/schemas/assistant";

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

  it("rejects name longer than 100 characters", () => {
    const result = renameAssistantSchema.safeParse({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects missing name field", () => {
    const result = renameAssistantSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
