import { describe, it, expect } from "vitest";
import { searchKnowledgeBaseSchema } from "@/schemas/chat/chat";

describe("searchKnowledgeBaseSchema — query min(1) (T3.7)", () => {
  it("rejects empty query string", () => {
    const result = searchKnowledgeBaseSchema.safeParse({ query: "" });

    expect(result.success).toBe(false);
  });

  it("rejects missing query", () => {
    const result = searchKnowledgeBaseSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("accepts a valid query", () => {
    const result = searchKnowledgeBaseSchema.safeParse({
      query: "valid query",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.query).toBe("valid query");
  });

  it("JSON-string branch: rejects empty query, accepts non-empty", () => {
    expect(searchKnowledgeBaseSchema.safeParse('{"query":""}').success).toBe(
      false,
    );
    expect(searchKnowledgeBaseSchema.safeParse('{"query":"x"}').success).toBe(
      true,
    );
  });

  it("wrapped branch: rejects empty nested query", () => {
    const result = searchKnowledgeBaseSchema.safeParse({
      search_knowledge_base: { query: "" },
    });

    expect(result.success).toBe(false);
  });
});
