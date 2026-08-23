// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

const dbSpy = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({ db: dbSpy }));

vi.mock("@/lib/mcp/get-mcp-tools", () => ({
  getMcpTools: vi.fn().mockResolvedValue({
    tools: {},
    toolSourceMap: {},
    cleanup: async () => {},
  }),
}));

const hybridSearchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rag/hybrid-search", () => ({
  hybridSearch: hybridSearchMock,
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { hybridSearch } from "@/lib/rag/hybrid-search";

const searchRows = [
  {
    content: "chunk text",
    score: 0.87,
    documentId: "doc-1",
    documentName: "Doc One",
    s3Key: "user-1/kb-1/doc-1/file.pdf",
  },
];

describe("registerMcpTools — search_knowledge_base (T3.3/T3.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hybridSearchMock.mockResolvedValue(searchRows);
  });

  it("registers search_knowledge_base when kbIsReady is true", async () => {
    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      false,
      "kb-1",
      true,
      "user-1",
    );

    expect(mcpTools["search_knowledge_base"]).toBeDefined();
  });

  it("does NOT register search_knowledge_base when kbIsReady is false", async () => {
    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      false,
      "kb-1",
      false,
      "user-1",
    );

    expect(mcpTools["search_knowledge_base"]).toBeUndefined();
  });

  it("does NOT query the database for KB readiness (T3.4)", async () => {
    await registerMcpTools([], undefined, false, "kb-1", true, "user-1");
    await registerMcpTools([], undefined, false, "kb-1", false, "user-1");

    expect(dbSpy.select).not.toHaveBeenCalled();
  });

  it("execute omits s3Key from results (T3.3)", async () => {
    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      false,
      "kb-1",
      true,
      "user-1",
    );
    const tool = mcpTools["search_knowledge_base"];

    const result = await tool.execute({ query: "test" }, {
      messages: [],
    } as any);

    expect(hybridSearch).toHaveBeenCalledWith("kb-1", "test", "user-1", 5);
    expect(result.results[0]).toEqual({
      content: "chunk text",
      relevanceScore: 0.87,
      documentId: "doc-1",
      documentName: "Doc One",
    });
    expect(result.results[0]).not.toHaveProperty("s3Key");
  });
});
