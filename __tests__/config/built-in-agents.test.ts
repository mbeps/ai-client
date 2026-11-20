import { describe, expect, it } from "vitest";
import {
  BUILT_IN_AGENT_IDS,
  BUILT_IN_AGENTS,
  getBuiltInAgentById,
  isBuiltInAgentId,
  isLinkableBuiltInAgentId,
  LINKABLE_BUILT_IN_AGENT_IDS,
  resolveBuiltInAgentByRoleOrId,
} from "@/config/built-in-agents";

describe("built-in-agents", () => {
  it("defines 5 built-in agents including kb-reader", () => {
    expect(BUILT_IN_AGENT_IDS).toEqual([
      "builtin:researcher",
      "builtin:planner",
      "builtin:reviewer",
      "builtin:worker",
      "builtin:kb-reader",
    ]);
    expect(BUILT_IN_AGENTS).toHaveLength(5);
    for (const agent of BUILT_IN_AGENTS) {
      expect(agent.isBuiltIn).toBe(true);
      expect(agent.subagentIds).toEqual([]);
      expect(agent.isOrchestrator).toBe(false);
    }
  });

  it("excludes builtin:kb-reader from LINKABLE_BUILT_IN_AGENT_IDS", () => {
    expect(LINKABLE_BUILT_IN_AGENT_IDS).toEqual([
      "builtin:researcher",
      "builtin:planner",
      "builtin:reviewer",
      "builtin:worker",
    ]);
  });

  it("configures tailored guardrails for general roles vs kb-reader", () => {
    const researcher = getBuiltInAgentById("builtin:researcher");
    expect(researcher?.guardrails).toEqual({
      maxSteps: 10,
      scratchpadAccess: "read_write",
      isolateTools: false,
    });

    const kbReader = getBuiltInAgentById("builtin:kb-reader");
    expect(kbReader?.guardrails).toEqual({
      maxSteps: 4,
      scratchpadAccess: "none",
      isolateTools: true,
    });
  });

  it("isBuiltInAgentId identifies valid built-in IDs", () => {
    expect(isBuiltInAgentId("builtin:researcher")).toBe(true);
    expect(isBuiltInAgentId("builtin:kb-reader")).toBe(true);
    expect(isBuiltInAgentId("builtin:unknown")).toBe(false);
    expect(isBuiltInAgentId("550e8400-e29b-41d4-a716-446655440000")).toBe(
      false,
    );
  });

  it("isLinkableBuiltInAgentId excludes builtin:kb-reader and unknown IDs", () => {
    expect(isLinkableBuiltInAgentId("builtin:researcher")).toBe(true);
    expect(isLinkableBuiltInAgentId("builtin:planner")).toBe(true);
    expect(isLinkableBuiltInAgentId("builtin:reviewer")).toBe(true);
    expect(isLinkableBuiltInAgentId("builtin:worker")).toBe(true);
    expect(isLinkableBuiltInAgentId("builtin:kb-reader")).toBe(false);
    expect(isLinkableBuiltInAgentId("custom-id")).toBe(false);
  });

  it("getBuiltInAgentById returns agent or undefined", () => {
    expect(getBuiltInAgentById("builtin:planner")?.name).toBe("Planner");
    expect(getBuiltInAgentById("non-existent")).toBeUndefined();
  });

  it("resolveBuiltInAgentByRoleOrId resolves by full ID or role slug (case-insensitive)", () => {
    expect(resolveBuiltInAgentByRoleOrId("builtin:researcher")?.id).toBe(
      "builtin:researcher",
    );
    expect(resolveBuiltInAgentByRoleOrId("researcher")?.id).toBe(
      "builtin:researcher",
    );
    expect(resolveBuiltInAgentByRoleOrId("REVIEWER")?.id).toBe(
      "builtin:reviewer",
    );
    expect(resolveBuiltInAgentByRoleOrId("kb-reader")?.id).toBe(
      "builtin:kb-reader",
    );
    expect(resolveBuiltInAgentByRoleOrId("unknown-role")).toBeUndefined();
  });
});
