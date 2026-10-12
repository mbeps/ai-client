import { describe, expect, it, vi } from "vitest";
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

describe("loadTransformContext", () => {
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
      null,
      false,
      "user-1",
    );
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
});
