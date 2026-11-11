vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbSelect = vi.hoisted(() => vi.fn());
vi.mock("@/drizzle/db", () => ({
  db: {
    select: mockDbSelect,
  },
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { getKnowledgebaseGraph } from "@/actions/knowledgebases/get-knowledgebase-graph";

const KB_ID = "kb-123";

describe("getKnowledgebaseGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns NOT_FOUND error when knowledgebase does not exist or belongs to another user", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([]),
      }),
    });

    const result = await getKnowledgebaseGraph(KB_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns documents and relations for a valid knowledgebase", async () => {
    // 1. KB ownership check
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ id: KB_ID }]),
      }),
    });

    const mockDocs = [
      {
        id: "doc-1",
        name: "Architecture.md",
        documentType: "technical_spec",
        summary: "System architecture",
        keyEntities: ["System", "Auth"],
        chunkCount: 10,
        tokenCount: 2500,
      },
      {
        id: "doc-2",
        name: "Security.md",
        documentType: "policy",
        summary: "Security guidelines",
        keyEntities: ["Auth", "Token"],
        chunkCount: 5,
        tokenCount: 1200,
      },
      {
        id: "doc-nulls",
        name: "Nulls.md",
        documentType: null,
        summary: null,
        keyEntities: null,
        chunkCount: null,
        tokenCount: null,
      },
    ];

    const mockRelations = [
      {
        id: "rel-1",
        sourceDocId: "doc-1",
        targetDocId: "doc-2",
        relationType: "references",
        reason: "Architecture references security policies",
      },
      {
        id: "rel-dangling",
        sourceDocId: "doc-1",
        targetDocId: "doc-deleted-or-not-ready",
        relationType: "references",
        reason: "Target doc is not ready",
      },
      {
        id: "rel-self",
        sourceDocId: "doc-1",
        targetDocId: "doc-1",
        relationType: "references",
        reason: "Self loop",
      },
    ];

    // 2. Documents query
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(mockDocs),
      }),
    });

    // 3. Relations query
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(mockRelations),
      }),
    });

    const result = await getKnowledgebaseGraph(KB_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.documents[0]).toEqual(mockDocs[0]);
      expect(result.value.documents[1]).toEqual(mockDocs[1]);
      expect(result.value.documents[2]).toEqual({
        id: "doc-nulls",
        name: "Nulls.md",
        documentType: "general",
        summary: "",
        keyEntities: [],
        chunkCount: 0,
        tokenCount: 0,
      });
      expect(result.value.relations).toEqual([mockRelations[0]]);
    }
  });

  it("handles empty knowledgebase with no documents and no relations", async () => {
    // 1. KB check
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ id: KB_ID }]),
      }),
    });

    // 2. Documents query empty
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([]),
      }),
    });

    // 3. Relations query empty
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([]),
      }),
    });

    const result = await getKnowledgebaseGraph(KB_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.documents).toEqual([]);
      expect(result.value.relations).toEqual([]);
    }
  });
});
