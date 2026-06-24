import { describe, it, expect } from "vitest";
import {
  createProjectSchema,
  updateProjectSchema,
  renameProjectSchema,
} from "@/schemas/project/project";

// ---------------------------------------------------------------------------
// createProjectSchema
// ---------------------------------------------------------------------------
describe("createProjectSchema", () => {
  it("accepts valid minimal data (name only)", () => {
    const result = createProjectSchema.safeParse({ name: "My Project" });
    expect(result.success).toBe(true);
  });

  it("accepts valid full data", () => {
    const result = createProjectSchema.safeParse({
      name: "My Project",
      description: "A project description",
      globalPrompt: "You are an expert.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createProjectSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createProjectSchema.safeParse({ name: "n".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts name exactly 100 characters", () => {
    const result = createProjectSchema.safeParse({ name: "n".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("rejects description longer than 500 characters", () => {
    const result = createProjectSchema.safeParse({
      name: "Valid",
      description: "d".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts description exactly 500 characters", () => {
    const result = createProjectSchema.safeParse({
      name: "Valid",
      description: "d".repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it("rejects globalPrompt longer than 10 000 characters", () => {
    const result = createProjectSchema.safeParse({
      name: "Valid",
      globalPrompt: "p".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts globalPrompt exactly 10 000 characters", () => {
    const result = createProjectSchema.safeParse({
      name: "Valid",
      globalPrompt: "p".repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  it("omits optional fields without error", () => {
    const result = createProjectSchema.safeParse({ name: "Valid" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateProjectSchema
// ---------------------------------------------------------------------------
describe("updateProjectSchema", () => {
  it("accepts empty object — all fields optional", () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts only name update", () => {
    const result = updateProjectSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts only globalPrompt update", () => {
    const result = updateProjectSchema.safeParse({
      globalPrompt: "Updated prompt.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects name longer than 100 characters", () => {
    const result = updateProjectSchema.safeParse({ name: "n".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 500 characters", () => {
    const result = updateProjectSchema.safeParse({
      description: "d".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// renameProjectSchema
// ---------------------------------------------------------------------------
describe("renameProjectSchema", () => {
  it("accepts valid name", () => {
    const result = renameProjectSchema.safeParse({ name: "Renamed Project" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = renameProjectSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = renameProjectSchema.safeParse({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects missing name field", () => {
    const result = renameProjectSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
