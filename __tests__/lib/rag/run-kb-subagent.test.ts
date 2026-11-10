import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHybridSearch = vi.hoisted(() => vi.fn());
const mockGetDocumentChunksByRange = vi.hoisted(() => vi.fn());
const mockExploreKbGraph = vi.hoisted(() => vi.fn());
const mockGenerateText = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/lib/rag/hybrid-search", () => ({
  hybridSearch: mockHybridSearch,
}));

vi.mock("@/lib/rag/qdrant-client", () => ({
  getDocumentChunksByRange: mockGetDocumentChunksByRange,
}));

vi.mock("@/lib/rag/explore-kb-graph", () => ({
  exploreKbGraph: mockExploreKbGraph,
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: mockGenerateText,
  };
});

vi.mock("@/drizzle/db", () => ({
  db: mockDb,
}));

import { runKbSubagent } from "@/lib/rag/run-kb-subagent";

describe("runKbSubagent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleInitialHits = [
    {
      content: "Initial hit chunk content",
      score: 0.92,
      documentId: "doc-1",
      documentName: "DocOne.md",
      s3Key: "uploads/doc1.md",
      kbId: "kb-1",
      kbName: "Docs",
    },
  ];

  const sampleCatalog = {
    documents: [
      {
        id: "doc-1",
        name: "DocOne.md",
        documentType: "technical_spec",
        summary: "Architecture and design",
        keyEntities: ["Auth", "Qdrant"],
        chunkCount: 5,
        tokenCount: 1500,
        tableOfContents: [{ title: "Intro", chunkStartIndex: 0, chunkEndIndex: 4 }],
      },
    ],
    relations: [
      {
        sourceDocId: "doc-1",
        sourceDocName: "DocOne.md",
        targetDocId: "doc-2",
        targetDocName: "DocTwo.md",
        relationType: "references",
        reason: "DocOne references DocTwo",
      },
    ],
  };

  it("returns fast-path results without calling LLM when model is not provided", async () => {
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockResolvedValueOnce(sampleCatalog);

    const result = await runKbSubagent({
      query: "architecture",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: undefined,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].content).toBe("Initial hit chunk content");
    expect(result.relatedDocuments).toHaveLength(1);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("handles multi-targetKbIds array in fast-path and subagent calls", async () => {
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockResolvedValueOnce(sampleCatalog);

    const result = await runKbSubagent({
      query: "architecture",
      targetKbIds: ["kb-1", "kb-2"],
      userId: "user-1",
      model: undefined,
    });

    expect(result.results).toHaveLength(1);
    expect(mockHybridSearch).toHaveBeenCalledWith(["kb-1", "kb-2"], "architecture", "user-1", 5);
  });

  it("returns fast-path results when both initial hits and catalog are empty", async () => {
    mockHybridSearch.mockResolvedValueOnce([]);
    mockExploreKbGraph.mockResolvedValueOnce({ documents: [], relations: [] });

    const result = await runKbSubagent({
      query: "empty query",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(result.results).toEqual([]);
    expect(result.relatedDocuments).toEqual([]);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("handles exploreKbGraph prefetch failure gracefully", async () => {
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockRejectedValueOnce(new Error("DB connection error"));

    const result = await runKbSubagent({
      query: "test",
      targetKbIds: ["kb-1"],
      userId: "user-1",
    });

    expect(result.results).toHaveLength(1);
    expect(result.relatedDocuments).toEqual([]);
  });

  it("executes generateText with tools and returns synthesized answer and citations", async () => {
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockResolvedValueOnce(sampleCatalog);

    mockGenerateText.mockImplementationOnce(async ({ tools, prompt }) => {
      expect(prompt).toContain("TIER 1 DOCUMENT CATALOG:");
      expect(prompt).toContain("DOCUMENT RELATIONSHIPS:");
      expect(prompt).toContain("INITIAL RETRIEVAL HITS:");

      // Simulate subagent calling explore_kb_graph without query
      await (tools.explore_kb_graph as any).execute({});

      // Simulate subagent calling search_kb_chunks with a duplicate hit + new hit
      mockHybridSearch.mockResolvedValueOnce([
        sampleInitialHits[0], // Duplicate hit to test collectedCitations.has(key)
        {
          content: "Second search hit",
          score: 0.88,
          documentId: "doc-2",
          documentName: "DocTwo.md",
          kbId: "kb-1",
        },
      ]);
      await (tools.search_kb_chunks as any).execute({
        query: "design",
        documentIds: ["doc-2"],
        limit: 3,
      });

      return {
        text: "Synthesized answer based on DocOne and DocTwo.",
      };
    });

    mockExploreKbGraph.mockResolvedValueOnce({
      documents: sampleCatalog.documents,
      relations: [
        {
          sourceDocId: "doc-1",
          sourceDocName: "DocOne.md",
          targetDocId: "doc-3",
          targetDocName: "DocThree.md",
          relationType: "supplements",
          reason: "DocThree supplements DocOne",
        },
      ],
    });

    const result = await runKbSubagent({
      query: "explain system",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(result.answer).toBe("Synthesized answer based on DocOne and DocTwo.");
    expect(result.results).toHaveLength(2);
    expect(result.relatedDocuments).toHaveLength(2);
  });

  it("handles empty initialHits when catalog has documents, formatting prompt with None available", async () => {
    mockHybridSearch.mockResolvedValueOnce([]); // No initial hits
    mockExploreKbGraph.mockResolvedValueOnce({
      documents: sampleCatalog.documents,
      relations: [], // Empty relations
    });

    mockGenerateText.mockImplementationOnce(async ({ prompt, tools }) => {
      expect(prompt).toContain("INITIAL RETRIEVAL HITS:\nNone available.");
      expect(prompt).toContain("DOCUMENT RELATIONSHIPS:\nNone available.");

      // Test search_kb_chunks with default limit
      mockHybridSearch.mockResolvedValueOnce([]);
      await (tools.search_kb_chunks as any).execute({ query: "keyword" });

      return {
        text: "Answer from catalog inspection.",
      };
    });

    const result = await runKbSubagent({
      query: "query with no vector matches",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(result.answer).toBe("Answer from catalog inspection.");
  });

  it("handles read_kb_document within budget and retrieves chunks with metadata", async () => {
    mockHybridSearch.mockResolvedValueOnce([
      {
        content: "Minimal hit",
        documentId: "doc-1",
        documentName: "DocOne.md",
      },
    ]);
    mockExploreKbGraph.mockResolvedValueOnce(sampleCatalog);

    mockGetDocumentChunksByRange.mockResolvedValueOnce([
      {
        content: "Detailed chapter 1 content",
        chunkIndex: 0,
        s3Key: "uploads/doc1.md",
        kbId: "kb-1",
        kbName: "Docs",
      },
    ]);

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-1",
        chunkStartIndex: 0,
        chunkEndIndex: 1,
      });
      expect(readRes.safeToRead).toBe(true);
      expect(readRes.chunks).toHaveLength(1);

      return {
        text: "   ", // whitespace only text -> answer should not be set
      };
    });

    const result = await runKbSubagent({
      query: "read chapter 1",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
      contextWindow: 32_768,
    });

    expect(result.answer).toBeUndefined();
    expect(result.results.some((r) => r.content === "Detailed chapter 1 content")).toBe(true);
  });

  it("handles read_kb_document when exceeding context budget and returns outline fallback", async () => {
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockResolvedValueOnce({
      documents: [
        {
          id: "doc-huge",
          name: "HugeDoc.pdf",
          documentType: "manual",
          summary: "Massive manual",
          keyEntities: ["System"],
          chunkCount: 100,
          tokenCount: 80_000,
          tableOfContents: [{ title: "Part 1", chunkStartIndex: 0, chunkEndIndex: 49 }],
        },
      ],
      relations: [],
    });

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-huge",
      });
      expect(readRes.safeToRead).toBe(false);
      expect(readRes.outline).toBeDefined();

      return {
        text: "Document too large; outline inspected.",
      };
    });

    const result = await runKbSubagent({
      query: "read huge doc",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
      contextWindow: 8_192,
    });

    expect(result.answer).toBe("Document too large; outline inspected.");
  });

  it("handles read_kb_document for unknown document ID", async () => {
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockResolvedValueOnce(sampleCatalog);

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }));

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "nonexistent-doc",
      });
      expect(readRes.safeToRead).toBe(false);
      expect(readRes.error).toBe("Document not found.");

      return {
        text: "Could not find document.",
      };
    });

    const result = await runKbSubagent({
      query: "read missing doc",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(result.answer).toBe("Could not find document.");
  });

  it("catches generateText failure and returns collected citations without throwing", async () => {
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockResolvedValueOnce(sampleCatalog);

    mockGenerateText.mockRejectedValueOnce(new Error("LLM provider timeout"));

    const result = await runKbSubagent({
      query: "query that fails in LLM",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(result.answer).toBeUndefined();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].content).toBe("Initial hit chunk content");
  });

  it("queries db for document in read_kb_document if not present in initial catalog and defaults metadata", async () => {
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockResolvedValueOnce({ documents: [], relations: [] });

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "doc-db",
            name: "DbDoc.md",
            tokenCount: null,
            chunkCount: null,
            documentType: null,
            summary: null,
            keyEntities: null,
            tableOfContents: null,
          },
        ]),
      }),
    }));

    mockGetDocumentChunksByRange.mockResolvedValueOnce([
      {
        content: "DB doc chunk content",
        chunkIndex: 0,
      },
    ]);

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-db",
      });
      expect(readRes.safeToRead).toBe(true);
      return { text: "DB doc read." };
    });

    const result = await runKbSubagent({
      query: "read db doc",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(result.answer).toBe("DB doc read.");
    expect(result.results.some((r) => r.content === "DB doc chunk content")).toBe(true);
  });
});
