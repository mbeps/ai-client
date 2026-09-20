// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/config/env", () => ({
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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";
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

    expect(mcpTools.search_knowledge_base).toBeDefined();
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

    expect(mcpTools.search_knowledge_base).toBeUndefined();
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
    const tool = mcpTools.search_knowledge_base;

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
    const tool = mcpTools.search_knowledge_base as any;

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
    const tool = mcpTools.manage_artifact as any;

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

    expect(mcpTools.shared_tool).toBeUndefined();
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

    expect(mcpTools.shared_tool).toBeDefined();
  });

  it("executes search_knowledge_base with valid query, empty query, and empty results", async () => {
    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      false,
      "kb-1",
      true,
      "user-1",
    );
    const searchTool = mcpTools.search_knowledge_base as any;

    // 1. Empty query
    const emptyRes = await searchTool.execute({ query: "   " });
    expect(emptyRes.success).toBe(false);
    expect(emptyRes.error).toContain("Missing mandatory 'query' parameter");

    // 2. 0 results
    hybridSearchMock.mockResolvedValueOnce([]);
    const noResultsRes = await searchTool.execute({ query: "quantum" });
    expect(noResultsRes.success).toBe(true);
    expect(noResultsRes.results).toEqual([]);

    // 3. Normal results
    hybridSearchMock.mockResolvedValueOnce(searchRows);
    const normalRes = await searchTool.execute({ query: "physics" });
    expect(normalRes.resultCount).toBe(1);
    expect(normalRes.results).toHaveLength(1);
  });

  it("executes manage_artifact tool successfully and handles execution errors", async () => {
    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      true,
      undefined,
      false,
      "user-1",
    );
    const artTool = mcpTools.manage_artifact as any;

    // 1. Success with markdown content
    const res1 = await artTool.execute({
      action: "create",
      type: "markdown",
      title: "Test Note",
      content: "# Heading",
    });
    expect(res1.success).toBe(true);
    expect(res1.artifact.title).toBe("Test Note");

    // 2. Success with sheets array
    const res2 = await artTool.execute({
      action: "create",
      type: "spreadsheet",
      title: "Sheet Note",
      sheets: [{ name: "S1", data: [["A"]] }],
    });
    expect(res2.success).toBe(true);

    // 3. Error case (pass circular or throwing getter)
    const badArgs = {
      action: "create",
      get type(): string {
        throw new Error("Broken getter");
      },
    };
    const errRes = await artTool.execute(badArgs);
    expect(errRes.success).toBe(false);
    expect(errRes.message).toBe("Broken getter");

    // 4. Sheets as string JSON array
    const resSheetsArray = await artTool.execute({
      action: "create",
      type: "spreadsheet",
      title: "Sheet Note 2",
      sheets: JSON.stringify([{ name: "S2", data: [[2]] }]),
    });
    expect(resSheetsArray.success).toBe(true);

    // 5. Sheets as string JSON object with .sheets
    const resSheetsObj = await artTool.execute({
      action: "create",
      type: "spreadsheet",
      title: "Sheet Note 3",
      sheets: JSON.stringify({ sheets: [{ name: "S3", data: [[3]] }] }),
    });
    expect(resSheetsObj.success).toBe(true);

    // 6. Sheets as invalid JSON string (fallback to raw string)
    const resSheetsRaw = await artTool.execute({
      action: "create",
      type: "spreadsheet",
      title: "Sheet Note 4",
      sheets: "not-json-sheets",
    });
    expect(resSheetsRaw.success).toBe(true);
    expect(resSheetsRaw.artifact.content).toBe("not-json-sheets");
  });

  it("handles empty tool selection array and getMcpTools error gracefully", async () => {
    const getMcpToolsMock = vi.mocked(getMcpTools);

    // 1. Explicitly empty selectedTools
    const { mcpTools: emptyTools } = await registerMcpTools(
      [{ id: "s1", name: "server", url: "http://x" } as any],
      [], // empty selection
      false,
      undefined,
      false,
      "user-1",
    );
    expect(Object.keys(emptyTools)).toHaveLength(0);

    // 2. getMcpTools rejects
    getMcpToolsMock.mockRejectedValueOnce(new Error("MCP connect failed"));
    const { mcpTools: failTools } = await registerMcpTools(
      [{ id: "s1", name: "server", url: "http://x" } as any],
      undefined,
      false,
      undefined,
      false,
      "user-1",
    );
    expect(Object.keys(failTools)).toHaveLength(0);
  });
});
