import { describe, expect, it } from "vitest";
import { RAG_CONFIG } from "@/config/rag";

describe("config/rag", () => {
  it("defines search candidate limit for vector and FTS retrieval", () => {
    expect(RAG_CONFIG.SEARCH_CANDIDATE_LIMIT).toBe(20);
  });
});
