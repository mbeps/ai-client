import { describe, expect, it } from "vitest";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import {
  createMemorySchema,
  deleteMemoriesSchema,
  saveMemoryToolSchema,
  updateMemorySchema,
} from "@/schemas/memory/memory";

describe("userMemory Schema & Validation", () => {
  it("defines the expected table columns and constraints", () => {
    expect(userMemory).toBeDefined();
    expect(userMemory.id).toBeDefined();
    expect(userMemory.userId).toBeDefined();
    expect(userMemory.content).toBeDefined();
    expect(userMemory.createdAt).toBeDefined();
    expect(userMemory.updatedAt).toBeDefined();
  });

  describe("createMemorySchema", () => {
    it("accepts valid content", () => {
      const parsed = createMemorySchema.parse({
        content: "User prefers TypeScript over JavaScript.",
      });
      expect(parsed.content).toBe("User prefers TypeScript over JavaScript.");
    });

    it("trims whitespace from content", () => {
      const parsed = createMemorySchema.parse({
        content: "   Clean code preference   ",
      });
      expect(parsed.content).toBe("Clean code preference");
    });

    it("rejects empty content", () => {
      expect(() => createMemorySchema.parse({ content: "   " })).toThrow();
    });

    it("rejects content exceeding max length", () => {
      const longContent = "a".repeat(2001);
      expect(() => createMemorySchema.parse({ content: longContent })).toThrow();
    });
  });

  describe("updateMemorySchema", () => {
    it("accepts valid id and content", () => {
      const id = crypto.randomUUID();
      const parsed = updateMemorySchema.parse({
        id,
        content: "Updated preference.",
      });
      expect(parsed.id).toBe(id);
      expect(parsed.content).toBe("Updated preference.");
    });

    it("rejects invalid UUID", () => {
      expect(() =>
        updateMemorySchema.parse({ id: "invalid-id", content: "Valid" }),
      ).toThrow();
    });
  });

  describe("deleteMemoriesSchema", () => {
    it("accepts valid array of UUIDs", () => {
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      const parsed = deleteMemoriesSchema.parse({ ids: [id1, id2] });
      expect(parsed.ids).toEqual([id1, id2]);
    });

    it("accepts a single UUID in array", () => {
      const id = crypto.randomUUID();
      const parsed = deleteMemoriesSchema.parse({ ids: [id] });
      expect(parsed.ids).toEqual([id]);
    });

    it("rejects empty array", () => {
      expect(() => deleteMemoriesSchema.parse({ ids: [] })).toThrow();
    });

    it("rejects non-UUID items in array", () => {
      expect(() =>
        deleteMemoriesSchema.parse({ ids: ["not-a-uuid"] }),
      ).toThrow();
    });
  });

  describe("saveMemoryToolSchema", () => {
    it("validates content argument for LLM tool invocation", () => {
      const parsed = saveMemoryToolSchema.parse({
        content: "User works at Acme Corp.",
      });
      expect(parsed.content).toBe("User works at Acme Corp.");
    });

    it("rejects empty memory content", () => {
      expect(() => saveMemoryToolSchema.parse({ content: "" })).toThrow();
    });
  });
});

