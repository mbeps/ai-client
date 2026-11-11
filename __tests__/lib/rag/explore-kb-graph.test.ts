import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({
  db: mockDb,
}));

import { exploreKbGraph } from "@/lib/rag/explore-kb-graph";

describe("exploreKbGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDocs = [
    {
      id: "doc-1",
      kbId: "kb-1",
      name: "Architecture.md",
      status: "ready",
      documentType: "technical_spec",
      summary: "System architecture and components overview",
      keyEntities: ["Auth", "Qdrant", "PostgreSQL"],
      chunkCount: 10,
      tokenCount: 4000,
      tableOfContents: [{ title: "Overview", chunkStartIndex: 0, chunkEndIndex: 9 }],
    },
    {
      id: "doc-2",
      kbId: "kb-1",
      name: "Database.md",
      status: "ready",
      documentType: "reference",
      summary: "PostgreSQL database schemas and indexes",
      keyEntities: ["PostgreSQL", "Drizzle", "Tables"],
      chunkCount: 8,
      tokenCount: 3000,
      tableOfContents: [{ title: "Schemas", chunkStartIndex: 0, chunkEndIndex: 7 }],
    },
    {
      id: "doc-3",
      kbId: "kb-1",
      name: "Security.md",
      status: "ready",
      documentType: "policy",
      summary: "Security guidelines and authentication policy",
      keyEntities: ["Auth", "JWT", "Encryption"],
      chunkCount: 5,
      tokenCount: 2000,
      tableOfContents: [{ title: "Policy", chunkStartIndex: 0, chunkEndIndex: 4 }],
    },
    {
      id: "doc-4",
      kbId: "kb-1",
      name: "Isolated.md",
      status: "ready",
      documentType: "general",
      summary: "Unrelated standalone note",
      keyEntities: ["Random"],
      chunkCount: 2,
      tokenCount: 500,
      tableOfContents: [],
    },
  ];

  const mockRelations = [
    {
      id: "rel-1",
      kbId: "kb-1",
      sourceDocId: "doc-1",
      targetDocId: "doc-2",
      relationType: "references",
      reason: "Architecture references database schema",
    },
    {
      id: "rel-2",
      kbId: "kb-1",
      sourceDocId: "doc-2",
      targetDocId: "doc-3",
      relationType: "supplements",
      reason: "Database security supplements security policy",
    },
  ];

  function setupDbMocks(docs = mockDocs, relations = mockRelations) {
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: any) => {
        return {
          where: vi.fn().mockImplementation(() => {
            const isRelations = Boolean(table.sourceDocId);
            return Promise.resolve(isRelations ? relations : docs);
          }),
        };
      }),
    }));
  }

  it("returns empty result if kbIds is empty", async () => {
    const result = await exploreKbGraph({ kbIds: [] });
    expect(result).toEqual({ documents: [], relations: [] });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns default Tier 1 catalog and interconnecting edges when neither query nor startDocId provided", async () => {
    setupDbMocks();

    const result = await exploreKbGraph({ kbIds: ["kb-1"] });

    expect(result.documents).toHaveLength(4);
    expect(result.relations).toHaveLength(2);
    expect(result.relations[0]).toEqual({
      sourceDocId: "doc-1",
      sourceDocName: "Architecture.md",
      targetDocId: "doc-2",
      targetDocName: "Database.md",
      relationType: "references",
      reason: "Architecture references database schema",
    });
  });

  it("traverses undirected graph up to specified depth from startDocId", async () => {
    setupDbMocks();

    const depth1Result = await exploreKbGraph({
      kbIds: ["kb-1"],
      startDocId: "doc-1",
      depth: 1,
    });

    expect(depth1Result.documents.map((d) => d.id).sort()).toEqual(["doc-1", "doc-2"]);
    expect(depth1Result.relations).toHaveLength(1);
    expect(depth1Result.relations[0].sourceDocId).toBe("doc-1");

    const depth2Result = await exploreKbGraph({
      kbIds: ["kb-1"],
      startDocId: "doc-1",
      depth: 2,
    });

    expect(depth2Result.documents.map((d) => d.id).sort()).toEqual([
      "doc-1",
      "doc-2",
      "doc-3",
    ]);
    expect(depth2Result.relations).toHaveLength(2);
  });

  it("clamps depth between 1 and 3", async () => {
    setupDbMocks();

    const resMin = await exploreKbGraph({
      kbIds: ["kb-1"],
      startDocId: "doc-1",
      depth: 0,
    });
    expect(resMin.documents.map((d) => d.id).sort()).toEqual(["doc-1", "doc-2"]);

    const resMax = await exploreKbGraph({
      kbIds: ["kb-1"],
      startDocId: "doc-1",
      depth: 5,
    });
    expect(resMax.documents.map((d) => d.id).sort()).toEqual([
      "doc-1",
      "doc-2",
      "doc-3",
    ]);
  });

  it("returns empty result if startDocId is not found in ready docs", async () => {
    setupDbMocks();

    const result = await exploreKbGraph({
      kbIds: ["kb-1"],
      startDocId: "nonexistent-doc",
    });

    expect(result.documents).toEqual([]);
    expect(result.relations).toEqual([]);
  });

  it("filters documents by query and includes their 1-hop neighbors", async () => {
    setupDbMocks();

    const result = await exploreKbGraph({
      kbIds: ["kb-1"],
      query: "security",
    });

    const docIds = result.documents.map((d) => d.id).sort();
    expect(docIds).toEqual(["doc-2", "doc-3"]);
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].sourceDocId).toBe("doc-2");
    expect(result.relations[0].targetDocId).toBe("doc-3");
  });

  it("matches query against keyEntities and documentType", async () => {
    setupDbMocks();

    const result = await exploreKbGraph({
      kbIds: ["kb-1"],
      query: "technical_spec",
    });

    const docIds = result.documents.map((d) => d.id).sort();
    expect(docIds).toEqual(["doc-1", "doc-2"]);
  });

  it("handles empty or whitespace query falling back to default catalog", async () => {
    setupDbMocks();

    const result = await exploreKbGraph({
      kbIds: ["kb-1"],
      query: "   ",
    });

    expect(result.documents).toHaveLength(4);
    expect(result.relations).toHaveLength(2);
  });

  it("handles documents with nullish metadata fields gracefully", async () => {
    const sparseDocs = [
      {
        id: "doc-sparse",
        kbId: "kb-1",
        name: "Sparse.md",
        status: "ready",
        documentType: null,
        summary: null,
        keyEntities: null,
        chunkCount: null,
        tokenCount: null,
        tableOfContents: null,
      },
    ];
    setupDbMocks(sparseDocs as any, []);

    const result = await exploreKbGraph({
      kbIds: ["kb-1"],
      query: "sparse",
    });

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toEqual({
      id: "doc-sparse",
      name: "Sparse.md",
      documentType: "general",
      summary: "",
      keyEntities: [],
      chunkCount: 0,
      tokenCount: 0,
      tableOfContents: [],
    });
  });

  it("handles relations where document name lookup falls back to ID", async () => {
    setupDbMocks(mockDocs, [
      {
        id: "rel-orphaned",
        kbId: "kb-1",
        sourceDocId: "doc-1",
        targetDocId: "deleted-doc",
        relationType: "references",
        reason: "Orphaned test edge",
      },
    ]);

    const result = await exploreKbGraph({
      kbIds: ["kb-1"],
      startDocId: "doc-1",
      depth: 1,
    });

    expect(result.documents.map((d) => d.id)).toEqual(["doc-1"]);
  });

  it("skips 1-hop relation expansion if neighbor document is not found in docMap", async () => {
    setupDbMocks(mockDocs, [
      {
        id: "rel-missing-neighbor",
        kbId: "kb-1",
        sourceDocId: "doc-1",
        targetDocId: "missing-peer-id",
        relationType: "references",
        reason: "Peer missing",
      },
    ]);

    const result = await exploreKbGraph({
      kbIds: ["kb-1"],
      query: "architecture",
    });

    expect(result.documents.map((d) => d.id)).toEqual(["doc-1"]);
    expect(result.relations).toHaveLength(0);
  });
});
