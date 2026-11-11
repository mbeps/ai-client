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

import { listDocuments } from "@/actions/knowledgebases/list-documents";

const KB_ID = "kb-123";

describe("listDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns NOT_FOUND error when knowledgebase is not found or not owned by user", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([]),
      }),
    });

    const result = await listDocuments(KB_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("computes relationCount from inbound and outbound edges in kbDocumentRelation", async () => {
    // 1. KB check query
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ id: KB_ID }]),
      }),
    });

    const mockDocs = [
      {
        id: "doc-1",
        kbId: KB_ID,
        name: "Doc 1.md",
        status: "ready",
        documentType: "technical_spec",
        summary: "Architecture spec",
        keyEntities: ["Auth", "OAuth"],
      },
      {
        id: "doc-2",
        kbId: KB_ID,
        name: "Doc 2.md",
        status: "ready",
        documentType: "manual",
        summary: "User manual",
        keyEntities: ["Setup"],
      },
      {
        id: "doc-3",
        kbId: KB_ID,
        name: "Doc 3.md",
        status: "ready",
        documentType: "report",
        summary: "Quarterly report",
        keyEntities: ["Metrics"],
      },
      {
        id: "doc-4",
        kbId: KB_ID,
        name: "Doc 4.md",
        status: "ready",
        documentType: "general",
        summary: "General notes",
        keyEntities: [],
      },
    ];

    const mockRelations = [
      { sourceDocId: "doc-1", targetDocId: "doc-2" },
      { sourceDocId: "doc-3", targetDocId: "doc-1" },
      { sourceDocId: "doc-1", targetDocId: "doc-3" },
    ];

    // 2. Documents query
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockResolvedValueOnce(mockDocs),
        }),
      }),
    });

    // 3. Relations query
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(mockRelations),
      }),
    });

    const result = await listDocuments(KB_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(4);
      expect(result.value[0]).toEqual({
        ...mockDocs[0],
        relationCount: 3,
      });
      expect(result.value[1]).toEqual({
        ...mockDocs[1],
        relationCount: 1,
      });
      expect(result.value[2]).toEqual({
        ...mockDocs[2],
        relationCount: 2,
      });
      expect(result.value[3]).toEqual({
        ...mockDocs[3],
        relationCount: 0,
      });
    }
  });

  it("handles empty relations list by returning relationCount 0 for all documents", async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ id: KB_ID }]),
      }),
    });

    const mockDocs = [
      {
        id: "doc-1",
        kbId: KB_ID,
        name: "Doc 1.md",
        status: "ready",
      },
    ];

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockResolvedValueOnce(mockDocs),
        }),
      }),
    });

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([]),
      }),
    });

    const result = await listDocuments(KB_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([
        {
          ...mockDocs[0],
          relationCount: 0,
        },
      ]);
    }
  });
});
