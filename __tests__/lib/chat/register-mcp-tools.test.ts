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

// Dual export shape per .agents/testing.md: domain-scoped getLogger plus the
// `logger` facade. Catch branches only surface their chosen message via the log,
// so the log is the only observable proof of which ternary arm ran.
const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => mockLog),
  logger: mockLog,
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

  it("passes multiple KB IDs to hybridSearch and includes kbId and kbName in results", async () => {
    vi.mocked(hybridSearch).mockResolvedValueOnce([
      {
        id: "chunk-1",
        content: "chunk text",
        score: 0.87,
        documentId: "doc-1",
        documentName: "Doc One",
        s3Key: "s3-key-1",
        chunkIndex: 0,
        kbId: "kb-1",
        kbName: "Docs",
      },
    ]);

    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      false,
      "kb-1",
      true,
      "user-1",
      ["kb-1", "kb-2"],
    );
    const tool = mcpTools.search_knowledge_base;

    const result = await tool.execute({ query: "multi query" }, {
      messages: [],
    } as any);

    expect(hybridSearch).toHaveBeenCalledWith(
      ["kb-1", "kb-2"],
      "multi query",
      "user-1",
      5,
    );
    expect(result.results[0]).toEqual({
      content: "chunk text",
      relevanceScore: 0.87,
      documentId: "doc-1",
      documentName: "Doc One",
      kbId: "kb-1",
      kbName: "Docs",
    });
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
      toolServerIdMap: { shared_tool: "a" },
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
      ["a:tool:shared_tool"],
      false,
      undefined,
      false,
      "user-1",
    );

    expect(mcpTools.shared_tool).toBeDefined();
  });

  it("selecting with the owning server's name enables the tool (backward compatibility)", async () => {
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

describe("registerMcpTools — fallback branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hybridSearchMock.mockResolvedValue(searchRows);
  });

  /**
   * Builds an args object whose `type` access throws a non-Error throwable.
   * That is the only way into the catch block, since `tool.execute` is called
   * directly and therefore skips input-schema validation.
   */
  const argsThrowing = (throwable: unknown) => ({
    action: "create",
    get type(): string {
      throw throwable;
    },
  });

  const registerArtifactTool = async () => {
    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      true,
      undefined,
      false,
      "user-1",
    );
    return mcpTools.manage_artifact as any;
  };

  it("logs the stringified throwable when getMcpTools rejects with a non-Error", async () => {
    vi.mocked(getMcpTools).mockRejectedValueOnce("socket hang up");

    const { mcpTools, mcpCleanup } = await registerMcpTools(
      [{ id: "s1", name: "server", url: "http://x" } as any],
      undefined,
      false,
      undefined,
      false,
      "user-1",
    );

    // Assert the log payload, not just that something was logged: the ternary
    // only differs in which value reaches `error`.
    expect(mockLog.warn).toHaveBeenCalledWith(
      "Failed to load MCP tools: {error}",
      { error: "socket hang up" },
    );
    // The rejection leaves the default no-op cleanup in place.
    expect(Object.keys(mcpTools)).toHaveLength(0);
    await expect(mcpCleanup()).resolves.toBeUndefined();
  });

  it("returns the default no-op mcpCleanup when there are no scoped servers", async () => {
    const { mcpCleanup } = await registerMcpTools(
      [],
      undefined,
      false,
      undefined,
      false,
      "user-1",
    );

    // Covers the `async () => {}` default assignment. Asserting it resolves
    // proves the declared no-op (not `result.cleanup`) is what was returned,
    // because a server-backed run would have returned the MCP cleanup instead.
    await expect(mcpCleanup()).resolves.toBeUndefined();
    expect(getMcpTools).not.toHaveBeenCalled();
  });

  it("uses the whole parsed object when stringified sheets is a JSON object with a sheets key", async () => {
    const artTool = await registerArtifactTool();

    const res = await artTool.execute({
      action: "create",
      type: "spreadsheet",
      sheets: JSON.stringify({ version: 1, sheets: [{ name: "S", data: [["v"]] }] }),
    });

    expect(res.success).toBe(true);
    // Whole object preserved, not re-wrapped under a second `sheets` key.
    expect(JSON.parse(res.artifact.content)).toEqual({
      version: 1,
      sheets: [{ name: "S", data: [["v"]] }],
    });
  });

  it("leaves content empty when stringified sheets is a JSON object with no sheets key", async () => {
    const artTool = await registerArtifactTool();

    const res = await artTool.execute({
      action: "create",
      type: "spreadsheet",
      sheets: JSON.stringify({ version: 1 }),
    });

    // Neither the array branch nor the `.sheets` branch applies, and the
    // fallback `""` is what reaches the artifact. `res.success` alone could not
    // tell this apart from a branch that did fire.
    expect(res.success).toBe(true);
    expect(res.artifact.content).toBe("");
  });

  it("falls back to the default title when the model omits one", async () => {
    const artTool = await registerArtifactTool();

    const res = await artTool.execute({
      action: "create",
      type: "markdown",
      content: "# Body",
    });

    expect(res.artifact.title).toBe("Generated Artifact");
  });

  it("stringifies a non-Error throwable in the artifact catch log and response", async () => {
    const artTool = await registerArtifactTool();

    const res = await artTool.execute(argsThrowing("tool harness exploded"));

    // Both ternaries share the same non-Error arm; assert the log AND the
    // response message, which pick different fallbacks.
    expect(mockLog.error).toHaveBeenCalledWith(
      "Failed to process artifact tool call: {error}",
      { error: "tool harness exploded" },
    );
    expect(res).toEqual({ success: false, message: "Unknown error occurred" });
  });

  it("prefers the Error message over the generic fallback for Error throwables", async () => {
    const artTool = await registerArtifactTool();

    const res = await artTool.execute(argsThrowing(new Error("disk quota")));

    expect(res).toEqual({ success: false, message: "disk quota" });
  });

  it("treats a missing query as empty and never hits the search backend", async () => {
    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      false,
      "kb-1",
      true,
      "user-1",
    );
    const searchTool = mcpTools.search_knowledge_base as any;

    const res = await searchTool.execute({});

    expect(res.success).toBe(false);
    expect(res.error).toContain("Missing mandatory 'query' parameter");
    // Proves the `query || ""` fallback fed the guard, not a real value.
    expect(hybridSearch).not.toHaveBeenCalled();
  });

  it("sanitises remote MCP tool names to conform to provider charset constraints", async () => {
    const getMcpToolsMock = vi.mocked(getMcpTools);
    getMcpToolsMock.mockResolvedValueOnce({
      tools: {
        "github.create_issue": { description: "Create Issue" },
      },
      toolSourceMap: { "github.create_issue": "GitHub" },
      toolServerIdMap: { "github.create_issue": "srv-1" },
      cleanup: vi.fn(),
    });

    const { mcpTools, toolSourceMap } = await registerMcpTools(
      [{ id: "srv-1", name: "GitHub" }] as any,
      undefined,
      false,
      undefined,
      false,
      "user-1",
    );

    expect(mcpTools).toHaveProperty("github_create_issue");
    expect(mcpTools).not.toHaveProperty("github.create_issue");
    expect(toolSourceMap.github_create_issue).toBe("GitHub");
  });
});
