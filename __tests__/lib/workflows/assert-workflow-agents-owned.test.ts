import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowNode } from "@/types/workflows/workflow";

const { mockWhere, mockFrom, mockSelect } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  return { mockWhere, mockFrom, mockSelect };
});

vi.mock("@/drizzle/db", () => ({
  db: { select: mockSelect },
}));

import { assertWorkflowAgentsOwned } from "@/lib/workflows/assert-workflow-agents-owned";

const USER_ID = "user-1";
const AGENT_1 = "11111111-1111-4111-8111-111111111111";
const AGENT_2 = "22222222-2222-4222-8222-222222222222";

function makeAiNode(id: string, agentId?: string): WorkflowNode {
  return {
    id,
    type: "ai_step",
    name: `AI ${id}`,
    position: { x: 0, y: 0 },
    data: {
      kind: "ai_step",
      variableName: `step_${id}`,
      agentId,
      prompt: "Run",
      mcpServerIds: [],
      toolIds: [],
      requiresReview: false,
    },
  };
}

function makeTriggerNode(id: string): WorkflowNode {
  return {
    id,
    type: "manual_trigger",
    name: "Trigger",
    position: { x: 0, y: 0 },
    data: {
      kind: "manual_trigger",
      variableName: "trigger",
    },
  };
}

describe("assertWorkflowAgentsOwned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when nodes are undefined or have no agentId", async () => {
    expect(await assertWorkflowAgentsOwned(USER_ID, undefined)).toBe(true);
    expect(
      await assertWorkflowAgentsOwned(USER_ID, [
        makeTriggerNode("t1"),
        makeAiNode("a1"),
      ]),
    ).toBe(true);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns true for built-in agent IDs without querying the database", async () => {
    const ok = await assertWorkflowAgentsOwned(USER_ID, [
      makeAiNode("a1", "builtin:researcher"),
      makeAiNode("a2", "builtin:planner"),
    ]);

    expect(ok).toBe(true);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns true when all deduplicated custom agent IDs belong to userId", async () => {
    mockWhere.mockResolvedValueOnce([{ id: AGENT_1 }, { id: AGENT_2 }]);

    const ok = await assertWorkflowAgentsOwned(USER_ID, [
      makeAiNode("a1", AGENT_1),
      makeAiNode("a2", AGENT_1),
      makeAiNode("a3", AGENT_2),
      makeAiNode("a4", "builtin:worker"),
    ]);

    expect(ok).toBe(true);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it("returns false when any custom agent ID is missing or owned by another user", async () => {
    mockWhere.mockResolvedValueOnce([{ id: AGENT_1 }]);

    const ok = await assertWorkflowAgentsOwned(USER_ID, [
      makeAiNode("a1", AGENT_1),
      makeAiNode("a2", AGENT_2),
    ]);

    expect(ok).toBe(false);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});
