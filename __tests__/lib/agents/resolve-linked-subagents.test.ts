import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock, fromMock, whereMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  whereMock: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: selectMock,
  },
}));

import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import { resolveLinkedSubagents } from "@/lib/agents/resolve-linked-subagents";

describe("resolveLinkedSubagents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ where: whereMock });
  });

  it("returns empty array without querying DB when targetIds is empty", async () => {
    const result = await resolveLinkedSubagents("user-1", []);
    expect(result).toEqual([]);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("resolves built-in agents without querying DB", async () => {
    const result = await resolveLinkedSubagents("user-1", [
      "builtin:researcher",
      "builtin:planner",
    ]);
    expect(result.map((a) => a.id)).toEqual([
      "builtin:researcher",
      "builtin:planner",
    ]);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("maps custom agent rows with null/undefined optional fields and preserves order", async () => {
    whereMock.mockResolvedValueOnce([
      {
        id: "agent-1",
        userId: "user-1",
        name: "Minimal Agent",
        description: null,
        prompt: null,
        subagentPrompt: null,
        modelId: null,
        knowledgebaseIds: undefined,
        tools: null,
        skillMode: undefined,
        skillIds: undefined,
        promptMode: undefined,
        promptIds: undefined,
        subagentIds: undefined,
        guardrails: undefined,
        avatar: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const result = await resolveLinkedSubagents("user-1", [
      "builtin:worker",
      "agent-1",
      "missing-id",
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("builtin:worker");
    expect(result[1]).toMatchObject({
      id: "agent-1",
      name: "Minimal Agent",
      description: "",
      prompt: "",
      subagentPrompt: "",
      modelId: null,
      knowledgebaseIds: [],
      tools: [],
      skillMode: "dynamic",
      skillIds: [],
      promptMode: "all",
      promptIds: [],
      subagentIds: [],
      guardrails: DEFAULT_AGENT_GUARDRAILS,
      avatar: null,
      isBuiltIn: false,
      isOrchestrator: false,
    });
  });
});
