import { beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_TOOL_IDS } from "@/config/tools";

const mockHybridSearch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rag/hybrid-search", () => ({
  hybridSearch: mockHybridSearch,
}));

import { registerKnowledgebaseTool } from "@/lib/chat/register-knowledgebase-tool";

describe("registerKnowledgebaseTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers tool when kb is ready and selectedTools is undefined", () => {
    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1", undefined);
    expect(tools.search_knowledge_base).toBeDefined();
  });

  it("registers tool when selectedTools includes INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE", () => {
    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1", [
      INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE,
    ]);
    expect(tools.search_knowledge_base).toBeDefined();
  });

  it("registers tool when selectedTools includes legacy 'search_knowledge_base'", () => {
    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1", [
      "search_knowledge_base",
    ]);
    expect(tools.search_knowledge_base).toBeDefined();
  });

  it("does not register tool when selectedTools excludes search_knowledge_base", () => {
    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1", [
      INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    ]);
    expect(tools.search_knowledge_base).toBeUndefined();
  });

  it("does not register tool when targetKbIds is empty", () => {
    const tools = registerKnowledgebaseTool([], true, "user-1", undefined);
    expect(tools.search_knowledge_base).toBeUndefined();
  });

  it("does not register tool when kbIsReady is false", () => {
    const tools = registerKnowledgebaseTool(["kb-1"], false, "user-1", undefined);
    expect(tools.search_knowledge_base).toBeUndefined();
  });

  it("executes search and returns normalised shape with success: true", async () => {
    mockHybridSearch.mockResolvedValueOnce([
      {
        content: "Result content",
        score: 0.95,
        documentId: "doc-1",
        documentName: "doc.txt",
        kbId: "kb-1",
        kbName: "Docs",
      },
    ]);

    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1");
    const result = await (tools.search_knowledge_base as any).execute({
      query: "architecture",
    });

    expect(result).toEqual({
      success: true,
      resultCount: 1,
      results: [
        {
          content: "Result content",
          relevanceScore: 0.95,
          documentId: "doc-1",
          documentName: "doc.txt",
          kbId: "kb-1",
          kbName: "Docs",
        },
      ],
    });
  });

  it("returns success: true and empty results when no hits found", async () => {
    mockHybridSearch.mockResolvedValueOnce([]);

    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1");
    const result = await (tools.search_knowledge_base as any).execute({
      query: "nonexistent",
    });

    expect(result).toEqual({
      success: true,
      results: [],
      resultCount: 0,
      message: "No results found for 'nonexistent'. Try using different keywords or broader search terms.",
    });
  });

  it("returns success: false when query is empty or whitespace", async () => {
    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1");
    const result = await (tools.search_knowledge_base as any).execute({
      query: "   ",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing mandatory 'query' parameter");
  });
});
