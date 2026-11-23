import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWorkflowContext } from "@/lib/workflows/load-workflow-context";

const mockSelect = vi.fn();
const mockResolveProvider = vi.fn();
const mockResolveDefaultProvider = vi.fn();
const mockRegisterMcpTools = vi.fn();
const mockHybridSearch = vi.fn();
const mockResolveLinkedSubagents = vi.fn();
const mockFilterOwnedKbIds = vi.fn();
const mockExploreKbGraph = vi.fn();
const mockMcpServerRowToConfig = vi.fn();

const mockEnv = vi.hoisted(() => ({
  RAG_MODE: "vector",
  TRANSFORM_TOP_K: 5,
}));

vi.mock("@/config/env", () => ({ env: mockEnv }));

vi.mock("@/drizzle/db", () => ({
  db: { select: (...args: unknown[]) => mockSelect(...args) },
}));

vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: (...args: unknown[]) => mockResolveProvider(...args),
}));

vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: (...args: unknown[]) =>
    mockResolveDefaultProvider(...args),
}));

vi.mock("@/lib/chat/register-mcp-tools", () => ({
  registerMcpTools: (...args: unknown[]) => mockRegisterMcpTools(...args),
}));

vi.mock("@/lib/rag/hybrid-search", () => ({
  hybridSearch: (...args: unknown[]) => mockHybridSearch(...args),
}));

vi.mock("@/lib/knowledgebases/filter-owned-kb-ids", () => ({
  filterOwnedKbIds: (...args: unknown[]) => mockFilterOwnedKbIds(...args),
}));

vi.mock("@/lib/rag/explore-kb-graph", () => ({
  exploreKbGraph: (...args: unknown[]) => mockExploreKbGraph(...args),
}));

vi.mock("@/lib/mcp/mcp-server-row-to-config", () => ({
  mcpServerRowToConfig: (...args: unknown[]) => mockMcpServerRowToConfig(...args),
}));

vi.mock("@/lib/agents/resolve-linked-subagents", () => ({
  resolveLinkedSubagents: (...args: unknown[]) =>
    mockResolveLinkedSubagents(...args),
}));

describe("loadWorkflowContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.RAG_MODE = "vector";
    mockMcpServerRowToConfig.mockImplementation((r: any) => ({ id: r.id, name: r.name }));
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: vi.fn().mockResolvedValue([]),
        innerJoin: () => ({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));
    mockResolveProvider.mockResolvedValue({
      modelId: "gpt-4o",
      sdkProvider: { chat: (id: string) => ({ modelId: id }) },
      modelRow: { contextWindow: 128000 },
    });
    mockResolveDefaultProvider.mockResolvedValue({
      modelId: "gpt-4o",
      sdkProvider: { chat: (id: string) => ({ modelId: id }) },
      modelRow: { contextWindow: 128000 },
    });
    mockRegisterMcpTools.mockResolvedValue({
      mcpTools: {},
      toolSourceMap: {},
      mcpCleanup: vi.fn(),
    });
    mockHybridSearch.mockResolvedValue([{ content: "KB snippet" }]);
    mockResolveLinkedSubagents.mockResolvedValue([]);
    mockFilterOwnedKbIds.mockResolvedValue(["kb-1"]);
    mockExploreKbGraph.mockResolvedValue({
      documents: [{ name: "Manual.pdf", documentType: "pdf", summary: "Guide" }],
    });
  });

  it("loads servers, provider, KB context, skills, subagents, and enables manage_artifact", async () => {
    let callIdx = 0;
    mockSelect.mockImplementation(() => ({
      from: () => {
        callIdx += 1;
        if (callIdx === 1) {
          return { where: vi.fn().mockResolvedValue([{ id: "s1", name: "S1" }]) };
        }
        return {
          where: vi.fn().mockResolvedValue([]),
          innerJoin: () => ({
            where: vi.fn().mockResolvedValue([{ id: "s2", name: "Pub" }]),
          }),
        };
      },
    }));

    const ctx = await loadWorkflowContext({
      userId: "u1",
      workflowRow: {
        id: "wf-1",
        name: "My Flow",
        description: "Desc",
        globalContext: "Global",
        modelId: null,
        knowledgeBaseIds: ["kb-1"],
        tools: [],
        skillMode: "dynamic",
        skillIds: [],
        subagentIds: ["sub-1"],
        canvasConfig: {
          enabled: true,
          allowedTypes: ["markdown"],
          defaultType: "markdown",
        },
      },
      nodes: [],
    });

    expect(ctx.allServers).toHaveLength(2);
    expect(ctx.kbContext).toContain("KB snippet");
    expect(mockRegisterMcpTools).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      true,
      "kb-1",
      true,
      "u1",
      ["kb-1"],
      expect.anything(),
    );
  });

  it("covers file_read RAG mode (owned docs, empty owned, empty docs), vector fallbacks, and skillMode none", async () => {
    mockEnv.RAG_MODE = "file_read";

    // File read with docs
    const res1 = await loadWorkflowContext({
      userId: "u1",
      workflowRow: {
        id: "wf-1",
        name: "Flow",
        description: null,
        globalContext: null,
        modelId: "gpt-4o",
        knowledgeBaseIds: ["kb-1"],
        tools: [],
        skillMode: "none",
        skillIds: null as any,
        subagentIds: [],
        canvasConfig: undefined as any,
      },
      nodes: [],
    });
    expect(res1.kbContext).toContain("Manual.pdf");

    // File read with no owned KB IDs
    mockFilterOwnedKbIds.mockResolvedValueOnce([]);
    const res2 = await loadWorkflowContext({
      userId: "u1",
      workflowRow: {
        id: "wf-1",
        name: "Flow",
        description: null,
        globalContext: null,
        modelId: null,
        knowledgeBaseIds: ["kb-foreign"],
        tools: null as any,
        skillMode: undefined as any,
        skillIds: [],
        subagentIds: [],
        canvasConfig: { enabled: false, allowedTypes: [] },
      },
      nodes: [
        {
          id: "n1",
          type: "ai_step",
          name: "Art",
          position: { x: 0, y: 0 },
          data: {
            kind: "ai_step",
            variableName: "s1",
            prompt: "Go",
            mcpServerIds: [],
            toolIds: [],
            requiresReview: false,
            canvasMode: "markdown",
          },
        },
      ],
    });
    expect(res2.kbContext).toBe("");

    // File read with empty documents + no chat function provider
    mockExploreKbGraph.mockResolvedValueOnce({ documents: [] });
    mockResolveProvider.mockResolvedValueOnce({ modelId: "no-chat", sdkProvider: {} } as any);
    const res3 = await loadWorkflowContext({
      userId: "u1",
      workflowRow: {
        id: "wf-1",
        name: "Flow",
        description: "FallbackDesc",
        globalContext: null,
        modelId: null,
        knowledgeBaseIds: ["kb-1"],
        tools: [],
        skillMode: "none",
        skillIds: [],
        subagentIds: [],
        canvasConfig: { enabled: false, allowedTypes: [] },
      },
      nodes: [],
      modelOverride: "custom-model",
    });
    expect(res3.kbContext).toBe("");
  });

  it("handles empty vector search results and non-Error RAG exceptions safely", async () => {
    mockHybridSearch.mockResolvedValueOnce([]);
    const resEmpty = await loadWorkflowContext({
      userId: "u1",
      workflowRow: {
        id: "wf-1",
        name: "FlowNameOnly",
        description: null,
        globalContext: null,
        modelId: null,
        knowledgeBaseIds: ["kb-1"],
        tools: [],
        skillMode: "none",
        skillIds: [],
        subagentIds: [],
        canvasConfig: { enabled: false, allowedTypes: [] },
      },
      nodes: [],
    });
    expect(resEmpty.kbContext).toBe("");

    mockHybridSearch.mockRejectedValueOnce("string error");
    const resThrowStr = await loadWorkflowContext({
      userId: "u1",
      workflowRow: {
        id: "wf-1",
        name: "FlowNameOnly",
        description: null,
        globalContext: null,
        modelId: null,
        knowledgeBaseIds: ["kb-1"],
        tools: [],
        skillMode: "none",
        skillIds: [],
        subagentIds: [],
        canvasConfig: { enabled: false, allowedTypes: [] },
      },
      nodes: [],
    });
    expect(resThrowStr.kbContext).toBe("");

    mockHybridSearch.mockRejectedValueOnce(new Error("Qdrant down"));
    const resThrowErr = await loadWorkflowContext({
      userId: "u1",
      workflowRow: {
        id: "wf-1",
        name: "FlowNameOnly",
        description: null,
        globalContext: null,
        modelId: null,
        knowledgeBaseIds: ["kb-1"],
        tools: [],
        skillMode: "none",
        skillIds: [],
        subagentIds: [],
        canvasConfig: { enabled: false, allowedTypes: [] },
      },
      nodes: [],
    });
    expect(resThrowErr.kbContext).toBe("");

    mockResolveDefaultProvider.mockResolvedValueOnce({
      modelId: "gpt-4o",
      sdkProvider: { chat: (id: string) => ({ modelId: id }) },
      modelRow: { contextWindow: undefined },
    });
    const resNoKb = await loadWorkflowContext({
      userId: "u1",
      workflowRow: {
        id: "wf-1",
        name: "NoKB",
        description: null,
        globalContext: null,
        modelId: null,
        knowledgeBaseIds: [],
        tools: [],
        skillMode: "none",
        skillIds: [],
        subagentIds: [],
        canvasConfig: { enabled: false, allowedTypes: [] },
      },
      nodes: [],
    });
    expect(resNoKb.kbContext).toBe("");
  });
});
