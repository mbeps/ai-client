import { beforeEach, describe, expect, it, vi } from "vitest";
import { encrypt } from "@/lib/encryption/encrypt";
import { loadTransformContext } from "@/lib/transform/load-transform-context";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));
vi.mock("@/drizzle/db", () => ({ db: dbMock }));

const registerMcpToolsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/register-mcp-tools", () => ({
  registerMcpTools: registerMcpToolsMock,
}));

const resolveProviderMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: resolveProviderMock,
}));

const resolveDefaultChatProviderMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: resolveDefaultChatProviderMock,
}));

const hybridSearchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rag/hybrid-search", () => ({
  hybridSearch: hybridSearchMock,
}));

const exploreKbGraphMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rag/explore-kb-graph", () => ({
  exploreKbGraph: exploreKbGraphMock,
}));

const filterOwnedKbIdsMock = vi.hoisted(() =>
  vi.fn(async (_userId: string, kbIds: string[]) => kbIds),
);
vi.mock("@/lib/knowledgebases/filter-owned-kb-ids", () => ({
  filterOwnedKbIds: filterOwnedKbIdsMock,
}));

const mockEnv = vi.hoisted(() => ({
  RAG_MODE: "hybrid" as "hybrid" | "vector" | "file_read",
  TRANSFORM_TOP_K: 5,
}));
vi.mock("@/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/env")>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get(target, prop) {
        if (prop in mockEnv) return mockEnv[prop as keyof typeof mockEnv];
        return Reflect.get(target, prop);
      },
    }),
  };
});

describe("loadTransformContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.RAG_MODE = "hybrid";
    mockEnv.TRANSFORM_TOP_K = 5;
    filterOwnedKbIdsMock.mockImplementation(
      async (_userId: string, kbIds: string[]) => kbIds,
    );
  });

  const createMockQuery = (resolvedValue: any = []) => {
    const q: any = {
      from: vi.fn().mockImplementation(() => q),
      innerJoin: vi.fn().mockImplementation(() => q),
      where: vi.fn().mockResolvedValue(resolvedValue),
    };
    return q;
  };

  it("loads servers, provider, and mcp tools successfully (combining personal and installed servers)", async () => {
    let callCount = 0;
    dbMock.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Personal servers
        return createMockQuery([{ id: "srv-1", name: "Personal MCP", enabled: true }]);
      }
      if (callCount === 2) {
        // Installed public servers
        return createMockQuery([{ id: "srv-pub-1", name: "Installed Public MCP", enabled: true }]);
      }
      return createMockQuery([]);
    });

    resolveProviderMock.mockResolvedValue({ modelId: "gpt-4" });
    registerMcpToolsMock.mockResolvedValue({
      mcpTools: { toolA: {} },
      toolSourceMap: new Map(),
      mcpCleanup: vi.fn(),
    });

    const agentRow = {
      id: "agent-1",
      name: "Test Agent",
      modelId: "openai/gpt-4",
      knowledgeBaseIds: [],
      steps: JSON.stringify([{ toolIds: [] }]),
    };

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow,
    });

    expect(ctx.resolvedProvider).toEqual({ modelId: "gpt-4" });
    expect(ctx.mcpTools).toHaveProperty("toolA");
    expect(ctx.allServers).toHaveLength(2);
    expect(ctx.allServers[0].name).toBe("Personal MCP");
    expect(ctx.allServers[1].name).toBe("Installed Public MCP");
  });

  it("decrypts encrypted MCP server headers for personal and installed servers", async () => {
    const encryptedPersonal = encrypt(
      JSON.stringify({ "X-Personal": "p-secret" }),
    );
    const encryptedInstalled = encrypt(
      JSON.stringify({ "X-Installed": "i-secret" }),
    );

    let callCount = 0;
    dbMock.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return createMockQuery([
          {
            id: "srv-1",
            name: "Personal MCP",
            url: "https://personal.example.com/mcp",
            headers: encryptedPersonal,
            enabled: true,
          },
        ]);
      }
      if (callCount === 2) {
        return createMockQuery([
          {
            id: "srv-pub-1",
            name: "Installed Public MCP",
            url: "https://installed.example.com/mcp",
            headers: encryptedInstalled,
            enabled: true,
          },
        ]);
      }
      return createMockQuery([]);
    });

    resolveProviderMock.mockResolvedValue({ modelId: "gpt-4" });
    registerMcpToolsMock.mockResolvedValue({
      mcpTools: {},
      toolSourceMap: new Map(),
      mcpCleanup: vi.fn(),
    });

    const agentRow = {
      id: "agent-1",
      name: "Test Agent",
      modelId: "openai/gpt-4",
      knowledgeBaseIds: [],
      steps: JSON.stringify([{ toolIds: [] }]),
    };

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow,
    });

    expect(ctx.allServers).toEqual([
      {
        id: "srv-1",
        name: "Personal MCP",
        url: "https://personal.example.com/mcp",
        headers: JSON.stringify({ "X-Personal": "p-secret" }),
        authType: "headers",
        oauthClientId: null,
        oauthClientSecret: null,
        oauthScope: null,
        autoApprovedTools: [],
        userId: "user-1",
      },
      {
        id: "srv-pub-1",
        name: "Installed Public MCP",
        url: "https://installed.example.com/mcp",
        headers: JSON.stringify({ "X-Installed": "i-secret" }),
        authType: "headers",
        oauthClientId: null,
        oauthClientSecret: null,
        oauthScope: null,
        autoApprovedTools: [],
        userId: "user-1",
      },
    ]);
  });

  it("retrieves KB context when knowledgeBaseIds are present", async () => {
    dbMock.select.mockImplementation(() => createMockQuery([]));

    resolveProviderMock.mockResolvedValue({ modelId: "gpt-4" });
    hybridSearchMock.mockResolvedValue([{ content: "KB Content 1" }]);
    registerMcpToolsMock.mockResolvedValue({
      mcpTools: {},
      toolSourceMap: new Map(),
      mcpCleanup: vi.fn(),
    });

    const agentRow = {
      id: "agent-1",
      name: "KB Agent",
      globalContext: "custom context",
      modelId: "openai/gpt-4",
      knowledgeBaseIds: ["kb-1"],
      steps: "invalid-json-steps",
      tools: ["internal:tool:manage_artifact"],
    };

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow,
    });

    expect(ctx.kbContext).toContain("Knowledge Base Context:");
    expect(ctx.kbContext).toContain("KB Content 1");
    expect(registerMcpToolsMock).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      true, // effectiveArtifactToolSelected from agentRow.tools
      "kb-1",
      true,
      "user-1",
      ["kb-1"],
    );
  });

  it("passes knowledgeBaseIds array in a single hybridSearch call when multiple KBs are configured", async () => {
    dbMock.select.mockImplementation(() => createMockQuery([]));
    resolveProviderMock.mockResolvedValue({ modelId: "gpt-4" });
    hybridSearchMock.mockResolvedValue([
      { content: "KB Content 1" },
      { content: "KB Content 2" },
    ]);
    registerMcpToolsMock.mockResolvedValue({
      mcpTools: {},
      toolSourceMap: new Map(),
      mcpCleanup: vi.fn(),
    });

    const agentRow = {
      id: "agent-multi-kb",
      name: "Multi KB Agent",
      globalContext: "multi kb context",
      modelId: "openai/gpt-4",
      knowledgeBaseIds: ["kb-1", "kb-2"],
      steps: "[]",
      tools: [],
    };

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow,
    });

    expect(hybridSearchMock).toHaveBeenCalledTimes(1);
    expect(hybridSearchMock).toHaveBeenCalledWith(
      ["kb-1", "kb-2"],
      "multi kb context",
      "user-1",
      expect.any(Number),
    );
    expect(ctx.kbContext).toContain("KB Content 1\n---\nKB Content 2");
  });

  it("handles empty KB results and KB retrieval failure gracefully", async () => {
    dbMock.select.mockImplementation(() => createMockQuery([]));

    resolveDefaultChatProviderMock.mockResolvedValue({ modelId: "default-model" });
    registerMcpToolsMock.mockResolvedValue({
      mcpTools: {},
      toolSourceMap: new Map(),
      mcpCleanup: vi.fn(),
    });

    // 1. Empty KB results
    hybridSearchMock.mockResolvedValueOnce([]);
    const ctxEmpty = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-1",
        name: "KB Agent",
        description: "agent desc",
        modelId: null,
        knowledgeBaseIds: ["kb-1"],
        subagentIds: ["builtin:researcher"],
        steps: JSON.stringify([{ toolIds: ["internal:tool:manage_artifact"] }]),
      },
    });
    expect(ctxEmpty.kbContext).toBe("");
    expect(ctxEmpty.resolvedProvider).toEqual({ modelId: "default-model" });

    // 2. Hybrid search throws
    hybridSearchMock.mockRejectedValueOnce(new Error("KB failure"));
    const ctxErr = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-1",
        name: "KB Agent",
        modelId: "",
        knowledgeBaseIds: ["kb-1"],
        steps: JSON.stringify([]),
      },
      anyArtifactToolSelected: true,
    });
    expect(ctxErr.kbContext).toBe("");
  });

  it("handles non-Error rejection in KB search and steps with missing toolIds", async () => {
    dbMock.select.mockImplementation(() => createMockQuery([]));

    resolveDefaultChatProviderMock.mockResolvedValue({ modelId: "default-model" });
    registerMcpToolsMock.mockResolvedValue({
      mcpTools: {},
      toolSourceMap: new Map(),
      mcpCleanup: vi.fn(),
    });

    hybridSearchMock.mockRejectedValueOnce("Plain string error");
    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-2",
        name: "Agent 2",
        knowledgeBaseIds: ["kb-2"],
        steps: JSON.stringify([{ notToolIds: 123 }, { toolIds: null }]),
      },
    });
    expect(ctx.kbContext).toBe("");
  });

  it("in file_read mode uses exploreKbGraph instead of hybridSearch and forwards kbSubagentConfig", async () => {
    mockEnv.RAG_MODE = "file_read";
    dbMock.select.mockImplementation(() => createMockQuery([]));

    const mockChatModel = { id: "chat-model-instance" };
    resolveProviderMock.mockResolvedValue({
      modelId: "gpt-4o",
      sdkProvider: { chat: vi.fn().mockReturnValue(mockChatModel) },
      modelRow: { contextWindow: 128_000 },
    });
    exploreKbGraphMock.mockResolvedValueOnce({
      documents: [
        {
          id: "doc-1",
          name: "Spec.md",
          documentType: "technical_spec",
          summary: "System architecture spec",
          keyEntities: [],
          chunkCount: 4,
          tokenCount: 1200,
          tableOfContents: [],
        },
      ],
      relations: [],
    });
    registerMcpToolsMock.mockResolvedValue({
      mcpTools: {},
      toolSourceMap: {},
      mcpCleanup: vi.fn(),
    });

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-fr",
        name: "FileRead Agent",
        modelId: "openai/gpt-4o",
        knowledgeBaseIds: ["kb-1"],
        steps: "[]",
      },
    });

    expect(hybridSearchMock).not.toHaveBeenCalled();
    expect(exploreKbGraphMock).toHaveBeenCalledWith({ kbIds: ["kb-1"] });
    expect(ctx.kbContext).toContain("Knowledge Base Document Catalog:");
    expect(ctx.kbContext).toContain('"Spec.md" (technical_spec): System architecture spec');
    expect(registerMcpToolsMock).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      false,
      "kb-1",
      true,
      "user-1",
      ["kb-1"],
      {
        model: mockChatModel,
        contextWindow: 128_000,
      },
    );
  });

  it("in file_read mode returns empty kbContext when exploreKbGraph returns no documents", async () => {
    mockEnv.RAG_MODE = "file_read";
    dbMock.select.mockImplementation(() => createMockQuery([]));

    resolveProviderMock.mockResolvedValue({
      modelId: "gpt-4o",
      sdkProvider: { chat: vi.fn().mockReturnValue({}) },
      modelRow: { contextWindow: null },
    });
    exploreKbGraphMock.mockResolvedValueOnce({
      documents: [],
      relations: [],
    });
    registerMcpToolsMock.mockResolvedValue({
      mcpTools: {},
      toolSourceMap: {},
      mcpCleanup: vi.fn(),
    });

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-fr-empty",
        name: "FileRead Empty",
        modelId: "openai/gpt-4o",
        knowledgeBaseIds: ["kb-1"],
        steps: "[]",
      },
    });

    expect(ctx.kbContext).toBe("");
    expect(registerMcpToolsMock).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      false,
      "kb-1",
      true,
      "user-1",
      ["kb-1"],
      {
        model: {},
        contextWindow: undefined,
      },
    );
  });

  it("in file_read mode filters out foreign knowledgeBaseIds before exploreKbGraph", async () => {
    mockEnv.RAG_MODE = "file_read";
    filterOwnedKbIdsMock.mockResolvedValueOnce([]);
    dbMock.select.mockImplementation(() => createMockQuery([]));

    resolveProviderMock.mockResolvedValue({
      modelId: "gpt-4o",
      sdkProvider: { chat: vi.fn().mockReturnValue({}) },
      modelRow: { contextWindow: null },
    });
    registerMcpToolsMock.mockResolvedValue({
      mcpTools: {},
      toolSourceMap: {},
      mcpCleanup: vi.fn(),
    });

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-fr-foreign",
        name: "FileRead Foreign",
        modelId: "openai/gpt-4o",
        knowledgeBaseIds: ["kb-foreign"],
        steps: "[]",
      },
    });

    expect(filterOwnedKbIdsMock).toHaveBeenCalledWith("user-1", ["kb-foreign"]);
    expect(exploreKbGraphMock).not.toHaveBeenCalled();
    expect(ctx.kbContext).toBe("");
  });
});
