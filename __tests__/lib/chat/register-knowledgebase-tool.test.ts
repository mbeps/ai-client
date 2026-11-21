import { beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_TOOL_IDS } from "@/config/tools";

const mockRunKbSubagent = vi.hoisted(() => vi.fn());
const mockHybridSearch = vi.hoisted(() => vi.fn());
const mockEnv = vi.hoisted(() => ({
  RAG_MODE: "hybrid" as "hybrid" | "vector" | "file_read",
  RAG_TOP_K: 5,
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/rag/run-kb-subagent", () => ({
  runKbSubagent: mockRunKbSubagent,
}));

vi.mock("@/lib/rag/hybrid-search", () => ({
  hybridSearch: mockHybridSearch,
}));

import { registerKnowledgebaseTool } from "@/lib/chat/register-knowledgebase-tool";

describe("registerKnowledgebaseTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.RAG_MODE = "hybrid";
    mockEnv.RAG_TOP_K = 5;
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

  it("registers tool even when selectedTools is empty or excludes search_knowledge_base", () => {
    const toolsEmpty = registerKnowledgebaseTool(["kb-1"], true, "user-1", []);
    expect(toolsEmpty.search_knowledge_base).toBeDefined();

    const toolsOther = registerKnowledgebaseTool(["kb-1"], true, "user-1", [
      INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    ]);
    expect(toolsOther.search_knowledge_base).toBeDefined();
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
    mockRunKbSubagent.mockResolvedValueOnce({
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
      relatedDocuments: [
        {
          sourceDocName: "doc.txt",
          targetDocName: "other.txt",
          relationType: "references",
          reason: "References other spec",
        },
      ],
    });

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
      relatedDocuments: [
        {
          sourceDocName: "doc.txt",
          targetDocName: "other.txt",
          relationType: "references",
          reason: "References other spec",
        },
      ],
    });
  });

  it("passes subagentConfig to runKbSubagent", async () => {
    mockRunKbSubagent.mockResolvedValueOnce({
      answer: "Synthesized answer from subagent",
      results: [],
    });

    const subagentConfig = {
      model: { modelId: "subagent-model" },
      contextWindow: 32_768,
    };

    const tools = registerKnowledgebaseTool(
      ["kb-1"],
      true,
      "user-1",
      undefined,
      subagentConfig,
    );

    const result = await (tools.search_knowledge_base as any).execute({
      query: "complex query",
    });

    expect(mockRunKbSubagent).toHaveBeenCalledWith({
      query: "complex query",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: subagentConfig.model,
      contextWindow: subagentConfig.contextWindow,
    });
    expect(result.answer).toBe("Synthesized answer from subagent");
  });

  it("returns success: true and empty results when no hits found and no answer", async () => {
    mockRunKbSubagent.mockResolvedValueOnce({
      results: [],
    });

    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1");
    const result = await (tools.search_knowledge_base as any).execute({
      query: "nonexistent",
    });

    expect(result).toEqual({
      success: true,
      results: [],
      resultCount: 0,
      message:
        "No results found for 'nonexistent'. Try using different keywords or broader search terms.",
    });
  });

  it("returns success: false when query is empty, whitespace, or omitted", async () => {
    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1");
    const result1 = await (tools.search_knowledge_base as any).execute({
      query: "   ",
    });
    expect(result1.success).toBe(false);
    expect(result1.error).toContain("Missing mandatory 'query' parameter");

    const result2 = await (tools.search_knowledge_base as any).execute({
      query: "",
    });
    expect(result2.success).toBe(false);
    expect(result2.error).toContain("Missing mandatory 'query' parameter");
  });

  it("formats toModelOutput correctly for errors, synthesis answers, and raw snippets", () => {
    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1");
    const toolInstance = tools.search_knowledge_base as any;
    expect(toolInstance.toModelOutput).toBeDefined();

    // 1. Error output with error property
    const errorOut = toolInstance.toModelOutput({
      output: { success: false, error: "Something broke" },
    });
    expect(errorOut).toEqual({
      type: "text",
      value: "Something broke",
    });

    // 1b. Error output without error property (fallback)
    const errorFallbackOut = toolInstance.toModelOutput({
      output: { success: false },
    });
    expect(errorFallbackOut).toEqual({
      type: "text",
      value: "Failed to search knowledge base.",
    });

    // 2. Empty results output
    const emptyOut = toolInstance.toModelOutput({
      output: { success: true, results: [], message: "No docs found" },
    });
    expect(emptyOut).toEqual({
      type: "text",
      value: "No docs found",
    });

    // 2b. Empty results output without message (fallback)
    const emptyFallbackOut = toolInstance.toModelOutput({
      output: { success: true },
    });
    expect(emptyFallbackOut).toEqual({
      type: "text",
      value: "No matching documents found in knowledge base.",
    });

    // 3. Synthesis answer with related docs and sources
    const synthesisOut = toolInstance.toModelOutput({
      output: {
        success: true,
        answer: "Here is the distilled summary.",
        results: [{ documentName: "A.md" }, { documentName: "B.md" }],
        relatedDocuments: [
          {
            sourceDocName: "A.md",
            targetDocName: "B.md",
            relationType: "references",
          },
        ],
      },
    });
    expect(synthesisOut.type).toBe("text");
    expect(synthesisOut.value).toContain("KNOWLEDGE BASE SYNTHESIS:");
    expect(synthesisOut.value).toContain("Here is the distilled summary.");
    expect(synthesisOut.value).toContain('DOCUMENT RELATIONSHIPS:\n- "A.md" references "B.md"');
    expect(synthesisOut.value).toContain('SOURCES:\n- "A.md"\n- "B.md"');

    // 3b. Synthesis answer without related docs or sources
    const synthesisMinimal = toolInstance.toModelOutput({
      output: {
        success: true,
        answer: "Standalone answer.",
      },
    });
    expect(synthesisMinimal).toEqual({
      type: "text",
      value: "KNOWLEDGE BASE SYNTHESIS:\nStandalone answer.",
    });

    // 4. Raw snippets fallback (when answer is absent)
    const snippetsOut = toolInstance.toModelOutput({
      output: {
        success: true,
        results: [
          { documentName: "A.md", content: "Snippet A content" },
          { documentName: "B.md", content: "Snippet B content" },
        ],
      },
    });
    expect(snippetsOut.type).toBe("text");
    expect(snippetsOut.value).toContain("[Source 1: A.md]\nSnippet A content");
    expect(snippetsOut.value).toContain("[Source 2: B.md]\nSnippet B content");
  });

  it("in vector mode calls hybridSearch directly without runKbSubagent and normalizes results", async () => {
    mockEnv.RAG_MODE = "vector";
    mockEnv.RAG_TOP_K = 7;
    mockHybridSearch.mockResolvedValueOnce([
      {
        id: "pt-1",
        content: "Direct vector chunk",
        score: 0.89,
        documentId: "doc-1",
        documentName: "Vector.md",
        s3Key: "uploads/vector.md",
        chunkIndex: 0,
        kbId: "kb-1",
        kbName: "KB One",
      },
      {
        id: "pt-2",
        content: "Minimal vector chunk",
        score: 0.72,
        documentId: "doc-2",
        documentName: "Minimal.md",
        s3Key: "uploads/minimal.md",
        chunkIndex: 1,
      },
    ]);

    const tools = registerKnowledgebaseTool(["kb-1"], true, "user-1");
    const result = await (tools.search_knowledge_base as any).execute({
      query: "  vector search  ",
    });

    expect(mockRunKbSubagent).not.toHaveBeenCalled();
    expect(mockHybridSearch).toHaveBeenCalledWith(
      "kb-1",
      "vector search",
      "user-1",
      7,
    );
    expect(result).toEqual({
      success: true,
      resultCount: 2,
      results: [
        {
          content: "Direct vector chunk",
          relevanceScore: 0.89,
          documentId: "doc-1",
          documentName: "Vector.md",
          kbId: "kb-1",
          kbName: "KB One",
        },
        {
          content: "Minimal vector chunk",
          relevanceScore: 0.72,
          documentId: "doc-2",
          documentName: "Minimal.md",
        },
      ],
    });
  });

  it("in vector mode passes array for multiple KBs and handles empty results", async () => {
    mockEnv.RAG_MODE = "vector";
    mockHybridSearch.mockResolvedValueOnce([]);

    const tools = registerKnowledgebaseTool(["kb-1", "kb-2"], true, "user-1");
    const result = await (tools.search_knowledge_base as any).execute({
      query: "nothing",
    });

    expect(mockRunKbSubagent).not.toHaveBeenCalled();
    expect(mockHybridSearch).toHaveBeenCalledWith(
      ["kb-1", "kb-2"],
      "nothing",
      "user-1",
      5,
    );
    expect(result).toEqual({
      success: true,
      results: [],
      resultCount: 0,
      message:
        "No results found for 'nothing'. Try using different keywords or broader search terms.",
    });
  });
});
