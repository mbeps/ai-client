import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { loadTransformContext } from "@/lib/transform/load-transform-context";

const SKILL_ONE = {
  id: "sk-1",
  name: "skill-one",
  displayName: "Skill One",
  description: "First",
  content: "One body",
};

const SKILL_TWO = {
  id: "sk-2",
  name: "skill-two",
  displayName: "Skill Two",
  description: "Second",
  content: "Two body",
};

const SKILL_THREE = {
  id: "sk-3",
  name: "skill-three",
  displayName: "Skill Three",
  description: "Third",
  content: "Three body",
};

function setupBaselineMocks() {
  resolveProviderMock.mockResolvedValue({ modelId: "gpt-4" });
  resolveDefaultChatProviderMock.mockResolvedValue({ modelId: "gpt-4" });
  registerMcpToolsMock.mockResolvedValue({
    mcpTools: {},
    toolSourceMap: {},
    mcpCleanup: vi.fn(),
  });
  hybridSearchMock.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupBaselineMocks();
});

describe("loadTransformContext skill configuration", () => {
  it("returns empty skills in none mode", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    dbMock.select.mockReturnValue(mockSelect);

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-1",
        name: "No Skills Agent",
        modelId: "openai/gpt-4",
        knowledgeBaseIds: [],
        steps: JSON.stringify([{ toolIds: [] }]),
        skillMode: "none",
        skillIds: ["sk-1"],
      },
    });

    expect(ctx.availableSkills).toEqual([]);
    expect(ctx.selectedSkills).toEqual([]);
  });

  it("preloads configured skills and offers the rest in specific mode", async () => {
    const skillChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([SKILL_ONE, SKILL_TWO, SKILL_THREE]),
    };
    const serverChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    dbMock.select
      .mockImplementationOnce(() => serverChain)
      .mockImplementationOnce(() => skillChain);

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-1",
        name: "Specific Agent",
        modelId: "openai/gpt-4",
        knowledgeBaseIds: [],
        steps: JSON.stringify([{ toolIds: [] }]),
        skillMode: "specific",
        skillIds: ["sk-1"],
      },
    });

    expect(ctx.selectedSkills).toEqual([SKILL_ONE]);
    expect(ctx.availableSkills).toEqual([
      {
        name: "skill-two",
        displayName: "Skill Two",
        description: "Second",
      },
      {
        name: "skill-three",
        displayName: "Skill Three",
        description: "Third",
      },
    ]);
  });

  it("catalogs every enabled skill in dynamic mode with nothing preloaded", async () => {
    const skillChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([SKILL_ONE, SKILL_TWO]),
    };
    const serverChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    dbMock.select
      .mockImplementationOnce(() => serverChain)
      .mockImplementationOnce(() => skillChain);

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-1",
        name: "Dynamic Agent",
        modelId: "openai/gpt-4",
        knowledgeBaseIds: [],
        steps: JSON.stringify([{ toolIds: [] }]),
        skillMode: "dynamic",
        skillIds: ["sk-2"],
      },
    });

    expect(ctx.selectedSkills).toEqual([]);
    expect(ctx.availableSkills.map((s) => s.name)).toEqual([
      "skill-one",
      "skill-two",
    ]);
  });

  it("matches configured skill ids by name in specific mode", async () => {
    const skillChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([SKILL_ONE, SKILL_TWO]),
    };
    const serverChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    dbMock.select
      .mockImplementationOnce(() => serverChain)
      .mockImplementationOnce(() => skillChain);

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-1",
        name: "Specific Agent",
        modelId: "openai/gpt-4",
        knowledgeBaseIds: [],
        steps: JSON.stringify([{ toolIds: [] }]),
        skillMode: "specific",
        skillIds: ["skill-two"],
      },
    });

    expect(ctx.selectedSkills).toEqual([SKILL_TWO]);
    expect(ctx.availableSkills.map((s) => s.name)).toEqual(["skill-one"]);
  });

  it("returns empty skills when the agent has no skill config and no enabled skills", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    dbMock.select.mockReturnValue(mockSelect);

    const ctx = await loadTransformContext({
      userId: "user-1",
      agentRow: {
        id: "agent-1",
        name: "Plain Agent",
        modelId: "openai/gpt-4",
        knowledgeBaseIds: [],
        steps: JSON.stringify([{ toolIds: [] }]),
      },
    });

    expect(ctx.availableSkills).toEqual([]);
    expect(ctx.selectedSkills).toEqual([]);
  });
});