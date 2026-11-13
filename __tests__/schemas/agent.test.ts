import { describe, expect, it } from "vitest";
import {
  agentEntitySchema,
  agentGuardrailsSchema,
  agentIdOrBuiltInField,
  createAgentSchema,
  deleteAgentSchema,
  renameAgentSchema,
  subagentTargetIdField,
  updateAgentSchema,
} from "@/schemas/agent/agent";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("agentIdOrBuiltInField & subagentTargetIdField", () => {
  it("accepts valid UUIDs and all built-in IDs for agentIdOrBuiltInField", () => {
    expect(agentIdOrBuiltInField.safeParse(VALID_UUID).success).toBe(true);
    expect(agentIdOrBuiltInField.safeParse("builtin:researcher").success).toBe(
      true,
    );
    expect(agentIdOrBuiltInField.safeParse("builtin:kb-reader").success).toBe(
      true,
    );
    expect(agentIdOrBuiltInField.safeParse("not-an-id").success).toBe(false);
  });

  it("accepts UUIDs and linkable built-in IDs, but rejects builtin:kb-reader for subagentTargetIdField", () => {
    expect(subagentTargetIdField.safeParse(VALID_UUID).success).toBe(true);
    expect(subagentTargetIdField.safeParse("builtin:worker").success).toBe(
      true,
    );
    expect(subagentTargetIdField.safeParse("builtin:kb-reader").success).toBe(
      false,
    );
    expect(subagentTargetIdField.safeParse("invalid").success).toBe(false);
  });
});

describe("agentGuardrailsSchema", () => {
  it("applies default values", () => {
    expect(agentGuardrailsSchema.parse({})).toEqual({
      maxSteps: 10,
      scratchpadAccess: "read_write",
      isolateTools: true,
    });
  });

  it("enforces maxSteps bounds 1..30", () => {
    expect(agentGuardrailsSchema.safeParse({ maxSteps: 1 }).success).toBe(true);
    expect(agentGuardrailsSchema.safeParse({ maxSteps: 30 }).success).toBe(
      true,
    );
    expect(agentGuardrailsSchema.safeParse({ maxSteps: 0 }).success).toBe(
      false,
    );
    expect(agentGuardrailsSchema.safeParse({ maxSteps: 31 }).success).toBe(
      false,
    );
    expect(agentGuardrailsSchema.safeParse({ maxSteps: 5.5 }).success).toBe(
      false,
    );
  });

  it("validates scratchpadAccess enum", () => {
    expect(
      agentGuardrailsSchema.safeParse({ scratchpadAccess: "read_only" })
        .success,
    ).toBe(true);
    expect(
      agentGuardrailsSchema.safeParse({ scratchpadAccess: "none" }).success,
    ).toBe(true);
    expect(
      agentGuardrailsSchema.safeParse({ scratchpadAccess: "invalid" }).success,
    ).toBe(false);
  });
});

describe("createAgentSchema & updateAgentSchema", () => {
  it("accepts minimal and full createAgentSchema payloads", () => {
    expect(createAgentSchema.safeParse({ name: "Research Helper" }).success).toBe(
      true,
    );
    expect(
      createAgentSchema.safeParse({
        name: "Full Agent",
        description: "A specialist agent",
        prompt: "System instructions",
        subagentPrompt: "Worker instructions",
        modelId: "gpt-4o",
        knowledgebaseIds: [VALID_UUID],
        tools: ["search_knowledge_base"],
        skillMode: "specific",
        skillIds: ["skill-1"],
        promptMode: "none",
        promptIds: [],
        subagentIds: [VALID_UUID, "builtin:researcher"],
        guardrails: {
          maxSteps: 15,
          scratchpadAccess: "read_only",
          isolateTools: false,
        },
        avatar: "https://example.com/avatar.png",
      }).success,
    ).toBe(true);
  });

  it("rejects non-linkable subagentIds in createAgentSchema", () => {
    expect(
      createAgentSchema.safeParse({
        name: "Invalid",
        subagentIds: ["builtin:kb-reader"],
      }).success,
    ).toBe(false);
  });

  it("supports partial updates without overwriting defaults in updateAgentSchema", () => {
    const parsed = updateAgentSchema.parse({ name: "Renamed" });
    expect(parsed).toEqual({ name: "Renamed" });
    expect(
      updateAgentSchema.safeParse({
        subagentIds: ["builtin:planner"],
        guardrails: {
          maxSteps: 5,
          scratchpadAccess: "none",
          isolateTools: true,
        },
        modelId: null,
      }).success,
    ).toBe(true);
  });
});

describe("renameAgentSchema, deleteAgentSchema & agentEntitySchema", () => {
  it("validates rename and delete schemas", () => {
    expect(renameAgentSchema.safeParse({ name: "New Name" }).success).toBe(
      true,
    );
    expect(renameAgentSchema.safeParse({ name: "" }).success).toBe(false);
    expect(deleteAgentSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
    expect(deleteAgentSchema.safeParse({ id: "bad" }).success).toBe(false);
  });

  it("validates full agentEntitySchema", () => {
    const now = new Date();
    const res = agentEntitySchema.safeParse({
      id: VALID_UUID,
      userId: "user-1",
      name: "Agent 1",
      description: "Desc",
      prompt: "Prompt",
      subagentPrompt: "",
      modelId: null,
      knowledgebaseIds: [],
      tools: [],
      skillMode: "dynamic",
      skillIds: [],
      promptMode: "all",
      promptIds: [],
      subagentIds: [],
      guardrails: {
        maxSteps: 10,
        scratchpadAccess: "read_write",
        isolateTools: true,
      },
      avatar: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(res.success).toBe(true);
  });
});
