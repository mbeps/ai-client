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
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";

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

  it("advertises a non-empty inputSchema for search_knowledge_base", async () => {
    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      false,
      "kb-1",
      true,
      "user-1",
    );
    const tool = mcpTools["search_knowledge_base"] as any;

    expect(tool.inputSchema).toBeDefined();
    // Union of accepted arg shapes; at least one member exposes `query`
    const members = tool.inputSchema.options ?? [tool.inputSchema];
    const hasQuery = members.some((m: any) => "query" in (m.shape ?? {}));
    expect(hasQuery).toBe(true);
  });

  it("advertises a non-empty inputSchema for manage_artifact", async () => {
    const { mcpTools } = await registerMcpTools(
      [{ id: "srv-1", name: "s", url: "http://x", type: "sse" } as any],
      undefined,
      true,
      undefined,
      false,
      "user-1",
    );
    const tool = mcpTools["manage_artifact"] as any;

    expect(tool.inputSchema).toBeDefined();
    const members = tool.inputSchema.options ?? [tool.inputSchema];
    const hasType = members.some((m: any) => "type" in (m.shape ?? {}));
    expect(hasType).toBe(true);
  });
});

describe("registerMcpTools — server-scoped tool selection (F8)", () => {
  const getMcpToolsMock = vi.mocked(getMcpTools);

  beforeEach(() => {
    vi.clearAllMocks();
    // Two servers expose the same tool name; getMcpTools merges by bare
    // name, so the first server wins and owns the merged entry.
    getMcpToolsMock.mockResolvedValue({
      tools: { shared_tool: { id: "from-srv-a" } },
      toolSourceMap: { shared_tool: "srv-a" },
      cleanup: async () => {},
    });
  });

  it("selecting the tool on one server does not enable it via another server's id", async () => {
    const { mcpTools } = await registerMcpTools(
      [{ id: "a", name: "srv-a", url: "http://x", type: "sse" } as any],
      ["srv-b:tool:shared_tool"],
      false,
      undefined,
      false,
      "user-1",
    );

    expect(mcpTools["shared_tool"]).toBeUndefined();
  });

  it("selecting with the owning server's full id enables the tool", async () => {
    const { mcpTools } = await registerMcpTools(
      [{ id: "a", name: "srv-a", url: "http://x", type: "sse" } as any],
      ["srv-a:tool:shared_tool"],
      false,
      undefined,
      false,
      "user-1",
    );

    expect(mcpTools["shared_tool"]).toBeDefined();
  });
});
