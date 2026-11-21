import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHybridSearch = vi.hoisted(() => vi.fn());
const mockGetDocumentChunksByRange = vi.hoisted(() => vi.fn());
const mockExploreKbGraph = vi.hoisted(() => vi.fn());
const mockGenerateText = vi.hoisted(() => vi.fn());
const mockReadS3DocumentChunksByRange = vi.hoisted(() => vi.fn());
const mockBuildDeterministicToc = vi.hoisted(() => vi.fn());
const mockEnv = vi.hoisted(() => ({
  RAG_MODE: "hybrid" as "hybrid" | "vector" | "file_read",
}));
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
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

vi.mock("@/lib/rag/read-s3-document-chunks", () => ({
  readS3DocumentChunksByRange: mockReadS3DocumentChunksByRange,
}));

vi.mock("@/lib/rag/extract-document-metadata", () => ({
  buildDeterministicToc: mockBuildDeterministicToc,
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

const mockFilterOwnedKbIds = vi.hoisted(() =>
  vi.fn(async (_userId: string, kbIds: string[]) => kbIds),
);
vi.mock("@/lib/knowledgebases/filter-owned-kb-ids", () => ({
  filterOwnedKbIds: mockFilterOwnedKbIds,
}));

import { runKbSubagent } from "@/lib/rag/run-kb-subagent";

describe("runKbSubagent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.RAG_MODE = "hybrid";
    mockFilterOwnedKbIds.mockImplementation(
      async (_userId: string, kbIds: string[]) => kbIds,
    );
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

  it("falls back to readS3DocumentChunksByRange in hybrid mode when Qdrant returns empty chunks", async () => {
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockResolvedValueOnce(sampleCatalog);
    mockGetDocumentChunksByRange.mockResolvedValueOnce([]);
    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "doc-1",
            name: "DocOne.md",
            mimeType: "text/markdown",
            s3Key: "uploads/doc1.md",
            kbId: "kb-1",
          },
        ]),
      }),
    }));
    mockReadS3DocumentChunksByRange.mockResolvedValueOnce([
      {
        id: "doc-1:0",
        content: "S3 fallback chunk content",
        documentId: "doc-1",
        documentName: "DocOne.md",
        s3Key: "uploads/doc1.md",
        chunkIndex: 0,
        kbId: "kb-1",
      },
    ]);

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-1",
        chunkStartIndex: 0,
        chunkEndIndex: 0,
      });
      expect(readRes.safeToRead).toBe(true);
      expect(readRes.chunks[0].content).toBe("S3 fallback chunk content");
      return { text: "Read from S3 fallback." };
    });

    const result = await runKbSubagent({
      query: "read fallback",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(mockReadS3DocumentChunksByRange).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-1",
        s3Key: "uploads/doc1.md",
        mimeType: "text/markdown",
        kbId: "kb-1",
      }),
    );
    expect(result.answer).toBe("Read from S3 fallback.");
  });

  it("in file_read mode skips hybridSearch, omits search_kb_chunks, and reads via S3 with cache", async () => {
    mockEnv.RAG_MODE = "file_read";
    mockExploreKbGraph
      .mockResolvedValueOnce(sampleCatalog)
      .mockResolvedValueOnce({
        documents: [
          sampleCatalog.documents[0],
          {
            id: "doc-query",
            name: "QueryMatch.md",
            documentType: "reference",
            summary: "Matched by query",
            keyEntities: [],
            chunkCount: 2,
            tokenCount: 400,
            tableOfContents: [],
          },
        ],
        relations: sampleCatalog.relations,
      });

    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "doc-1",
            name: "DocOne.md",
            mimeType: "text/markdown",
            s3Key: "uploads/doc1.md",
            kbId: "kb-1",
          },
        ]),
      }),
    }));

    mockReadS3DocumentChunksByRange.mockResolvedValue([
      {
        id: "doc-1:0",
        content: "File read S3 chunk",
        documentId: "doc-1",
        documentName: "DocOne.md",
        s3Key: "uploads/doc1.md",
        chunkIndex: 0,
        kbId: "kb-1",
      },
    ]);

    mockGenerateText.mockImplementationOnce(async ({ tools, prompt }) => {
      expect(tools.search_kb_chunks).toBeUndefined();
      expect(tools.explore_kb_graph).toBeDefined();
      expect(tools.read_kb_document).toBeDefined();
      expect(prompt).toContain("QueryMatch.md");

      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-1",
        chunkStartIndex: 0,
        chunkEndIndex: 0,
      });
      expect(readRes.safeToRead).toBe(true);
      expect(readRes.chunks[0].content).toBe("File read S3 chunk");
      return { text: "File read answer." };
    });

    const result = await runKbSubagent({
      query: "architecture",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(mockHybridSearch).not.toHaveBeenCalled();
    expect(mockGetDocumentChunksByRange).not.toHaveBeenCalled();
    expect(mockReadS3DocumentChunksByRange).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-1",
        cache: expect.any(Map),
      }),
    );
    expect(result.answer).toBe("File read answer.");
  });

  it("in file_read mode generates deterministic TOC fallback for oversized doc with empty tableOfContents", async () => {
    mockEnv.RAG_MODE = "file_read";
    mockExploreKbGraph
      .mockResolvedValueOnce({
        documents: [
          {
            id: "doc-oversized",
            name: "Oversized.pdf",
            documentType: "manual",
            summary: "Large doc without TOC",
            keyEntities: [],
            chunkCount: 10,
            tokenCount: 50_000,
            tableOfContents: [],
          },
        ],
        relations: [],
      })
      .mockRejectedValueOnce(new Error("query explore failed"));

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "doc-oversized",
            name: "Oversized.pdf",
            mimeType: "application/pdf",
            s3Key: "uploads/oversized.pdf",
            kbId: "kb-1",
          },
        ]),
      }),
    }));

    mockReadS3DocumentChunksByRange.mockResolvedValueOnce([
      {
        id: "doc-oversized:0",
        content: "# Section 1\nBody",
        documentId: "doc-oversized",
        documentName: "Oversized.pdf",
        s3Key: "uploads/oversized.pdf",
        chunkIndex: 0,
        kbId: "kb-1",
      },
    ]);
    mockBuildDeterministicToc.mockReturnValueOnce([
      { title: "Section 1", chunkStartIndex: 0, chunkEndIndex: 9 },
    ]);

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-oversized",
      });
      expect(readRes.safeToRead).toBe(false);
      expect(readRes.outline).toEqual([
        { title: "Section 1", chunkStartIndex: 0, chunkEndIndex: 9 },
      ]);
      return { text: "Used deterministic TOC." };
    });

    const result = await runKbSubagent({
      query: "oversized",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
      contextWindow: 8_192,
    });

    expect(mockBuildDeterministicToc).toHaveBeenCalled();
    expect(result.answer).toBe("Used deterministic TOC.");
  });

  it("in file_read mode returns Document not found when S3 metadata cannot be resolved", async () => {
    mockEnv.RAG_MODE = "file_read";
    mockExploreKbGraph
      .mockResolvedValueOnce(sampleCatalog)
      .mockResolvedValueOnce({ documents: [], relations: [] });

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }));

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-1",
      });
      expect(readRes.safeToRead).toBe(false);
      expect(readRes.error).toBe("Document not found.");
      return { text: "Missing S3 metadata." };
    });

    const result = await runKbSubagent({
      query: "missing s3",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(result.answer).toBe("Missing S3 metadata.");
  });

  it("in hybrid mode falls back to window TOC when oversized doc has empty tableOfContents", async () => {
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockResolvedValueOnce({
      documents: [
        {
          id: "doc-vec-huge",
          name: "VectorOnlyHuge.pdf",
          documentType: "general",
          summary: "",
          keyEntities: [],
          chunkCount: 7,
          tokenCount: 50_000,
          tableOfContents: [],
        },
      ],
      relations: [],
    });

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-vec-huge",
      });
      expect(readRes.safeToRead).toBe(false);
      expect(readRes.outline).toEqual([
        { title: "Section 1 (Chunks 0–4)", chunkStartIndex: 0, chunkEndIndex: 4 },
        { title: "Section 2 (Chunks 5–6)", chunkStartIndex: 5, chunkEndIndex: 6 },
      ]);
      return { text: "Used window TOC fallback." };
    });

    const result = await runKbSubagent({
      query: "read vector-only huge doc",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
      contextWindow: 8_192,
    });

    expect(result.answer).toBe("Used window TOC fallback.");
  });

  it("in file_read mode caches s3Meta from DB lookup and handles empty query and duplicate catalog docs", async () => {
    mockEnv.RAG_MODE = "file_read";
    mockExploreKbGraph.mockResolvedValueOnce(sampleCatalog);

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "doc-uncataloged",
            name: "Uncataloged.md",
            mimeType: "text/markdown",
            s3Key: "uploads/uncataloged.md",
            kbId: "kb-1",
            tokenCount: 100,
            chunkCount: 1,
            documentType: "general",
            summary: "Summary",
            keyEntities: [],
            tableOfContents: [],
          },
        ]),
      }),
    }));

    mockReadS3DocumentChunksByRange.mockResolvedValue([
      {
        id: "doc-uncataloged:0",
        content: "Uncataloged chunk",
        documentId: "doc-uncataloged",
        documentName: "Uncataloged.md",
        s3Key: "uploads/uncataloged.md",
        chunkIndex: 0,
        kbId: "kb-1",
      },
    ]);

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const first = await (tools.read_kb_document as any).execute({
        documentId: "doc-uncataloged",
      });
      expect(first.safeToRead).toBe(true);
      const second = await (tools.read_kb_document as any).execute({
        documentId: "doc-uncataloged",
        chunkStartIndex: 0,
        chunkEndIndex: 0,
      });
      expect(second.safeToRead).toBe(true);
      return { text: "Read uncataloged twice." };
    });

    const result = await runKbSubagent({
      query: "   ",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(result.answer).toBe("Read uncataloged twice.");
  });

  it("handles missing s3Meta and empty S3 chunks in oversized TOC fallback and hybrid S3 fallback", async () => {
    // 1. file_read mode: oversized doc with empty S3 chunks -> falls back to window TOC
    mockEnv.RAG_MODE = "file_read";
    mockExploreKbGraph
      .mockResolvedValueOnce({
        documents: [
          {
            id: "doc-empty-s3",
            name: "EmptyS3.pdf",
            documentType: "manual",
            summary: "Empty S3 doc",
            keyEntities: [],
            chunkCount: 4,
            tokenCount: 50_000,
            tableOfContents: [],
          },
        ],
        relations: [],
      })
      .mockResolvedValueOnce({ documents: [], relations: [] });

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "doc-empty-s3",
            name: "EmptyS3.pdf",
            mimeType: "application/pdf",
            s3Key: "uploads/empty.pdf",
            kbId: "kb-1",
          },
        ]),
      }),
    }));
    mockReadS3DocumentChunksByRange.mockResolvedValueOnce([]);

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-empty-s3",
      });
      expect(readRes.safeToRead).toBe(false);
      expect(readRes.outline).toEqual([
        { title: "Section 1 (Chunks 0–3)", chunkStartIndex: 0, chunkEndIndex: 3 },
      ]);
      return { text: "Window fallback from empty S3." };
    });

    await runKbSubagent({
      query: "empty s3",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
      contextWindow: 8_192,
    });

    // 2. file_read mode: oversized doc with no S3 metadata -> falls back to window TOC
    mockExploreKbGraph
      .mockResolvedValueOnce({
        documents: [
          {
            id: "doc-no-meta",
            name: "NoMeta.pdf",
            documentType: "manual",
            summary: "No S3 meta",
            keyEntities: [],
            chunkCount: 3,
            tokenCount: 50_000,
            tableOfContents: [],
          },
        ],
        relations: [],
      })
      .mockResolvedValueOnce({ documents: [], relations: [] });

    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }));

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-no-meta",
      });
      expect(readRes.safeToRead).toBe(false);
      expect(readRes.outline).toEqual([
        { title: "Section 1 (Chunks 0–2)", chunkStartIndex: 0, chunkEndIndex: 2 },
      ]);
      return { text: "Window fallback from missing meta." };
    });

    await runKbSubagent({
      query: "no meta",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
      contextWindow: 8_192,
    });

    // 3. hybrid mode: Qdrant returns [] and S3 meta is missing -> returns empty chunks cleanly
    mockEnv.RAG_MODE = "hybrid";
    mockHybridSearch.mockResolvedValueOnce(sampleInitialHits);
    mockExploreKbGraph.mockResolvedValueOnce(sampleCatalog);
    mockGetDocumentChunksByRange.mockResolvedValueOnce([]);
    mockDb.select.mockImplementationOnce(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }));

    mockGenerateText.mockImplementationOnce(async ({ tools }) => {
      const readRes = await (tools.read_kb_document as any).execute({
        documentId: "doc-1",
      });
      expect(readRes.safeToRead).toBe(true);
      expect(readRes.chunks).toEqual([]);
      return { text: "Empty chunks handled." };
    });

    const hybridRes = await runKbSubagent({
      query: "empty hybrid fallback",
      targetKbIds: ["kb-1"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });
    expect(hybridRes.answer).toBe("Empty chunks handled.");
  });

  it("in file_read mode returns empty results when no targetKbIds are owned by userId", async () => {
    mockEnv.RAG_MODE = "file_read";
    mockFilterOwnedKbIds.mockResolvedValueOnce([]);

    const result = await runKbSubagent({
      query: "secret",
      targetKbIds: ["kb-foreign"],
      userId: "user-1",
      model: { modelId: "test-model" },
    });

    expect(mockFilterOwnedKbIds).toHaveBeenCalledWith("user-1", ["kb-foreign"]);
    expect(mockExploreKbGraph).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(result).toEqual({ results: [], relatedDocuments: [] });
  });
});
