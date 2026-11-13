vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "leftJoin",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn();
  }
  c.where = vi.fn().mockImplementation(() => c);
  c.orderBy = vi.fn().mockImplementation(() => c);
  c.limit = vi.fn().mockImplementation(() => c);
  c.offset = vi.fn().mockImplementation(() => c);
  c.$dynamic = vi.fn().mockImplementation(() => c);
  c.returning = vi.fn();
  c.transaction = vi.fn();

  for (const m of [
    "select",
    "from",
    "leftJoin",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m].mockImplementation(() => c);
  }
  c.orderBy.mockResolvedValue([]);
  c.returning.mockResolvedValue([]);
  c.transaction.mockImplementation(
    async (fn: (tx: typeof c) => Promise<unknown>) => fn(c),
  );
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

const mockValidateTargetSubagentIds = vi.hoisted(() => vi.fn());
const mockValidateAgentCanBecomeOrchestrator = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agents/validate-subagent-links", () => ({
  validateTargetSubagentIds: mockValidateTargetSubagentIds,
  validateAgentCanBecomeOrchestrator: mockValidateAgentCanBecomeOrchestrator,
}));

import { createAgent } from "@/actions/agents/create-agent";
import { deleteAgent } from "@/actions/agents/delete-agent";
import { listAgents } from "@/actions/agents/list-agents";
import { renameAgent } from "@/actions/agents/rename-agent";
import { updateAgent } from "@/actions/agents/update-agent";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";

const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const SUBAGENT_ID = "22222222-2222-4222-8222-222222222222";

const AGENT_ROW = {
  id: AGENT_ID,
  userId: "user-1",
  name: "Test Agent",
  description: null,
  prompt: null,
  subagentPrompt: null,
  modelId: null,
  knowledgebaseIds: [],
  tools: [...DEFAULT_ENABLED_TOOLS],
  skillMode: "dynamic" as const,
  skillIds: [],
  promptMode: "all" as const,
  promptIds: [],
  subagentIds: [],
  guardrails: DEFAULT_AGENT_GUARDRAILS,
  avatar: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.resetAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  chainable.leftJoin.mockReturnValue(chainable);
  chainable.limit.mockReturnValue(chainable);
  chainable.insert.mockReturnValue(chainable);
  chainable.values.mockReturnValue(chainable);
  chainable.update.mockReturnValue(chainable);
  chainable.set.mockReturnValue(chainable);
  chainable.delete.mockReturnValue(chainable);
  chainable.where.mockImplementation(() => chainable);
  chainable.$dynamic.mockImplementation(() => chainable);
  chainable.orderBy.mockResolvedValue([]);
  chainable.returning.mockResolvedValue([]);
  chainable.transaction.mockImplementation(
    async (fn: (tx: typeof chainable) => Promise<unknown>) => fn(chainable),
  );
  vi.mocked(requireSession).mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: {
      id: "session-1",
      token: "tok",
      userId: "user-1",
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    role: "user",
  } as Awaited<ReturnType<typeof requireSession>>);
  mockValidateTargetSubagentIds.mockResolvedValue({
    ok: true,
    value: undefined,
  });
  mockValidateAgentCanBecomeOrchestrator.mockResolvedValue({
    ok: true,
    value: undefined,
  });
});

describe("createAgent", () => {
  it("creates an agent with defaults when minimal fields are provided", async () => {
    chainable.returning.mockResolvedValueOnce([AGENT_ROW]);
    const res = await createAgent({ name: "Test Agent" });
    expect(res).toEqual({ ok: true, value: AGENT_ROW });
    expect(mockValidateTargetSubagentIds).not.toHaveBeenCalled();
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Test Agent",
        userId: "user-1",
        tools: [...DEFAULT_ENABLED_TOOLS],
        subagentIds: [],
        guardrails: DEFAULT_AGENT_GUARDRAILS,
      }),
    );
  });

  it("validates subagentIds when creating an orchestrator agent", async () => {
    chainable.returning.mockResolvedValueOnce([
      { ...AGENT_ROW, subagentIds: [SUBAGENT_ID] },
    ]);
    const res = await createAgent({
      name: "Orchestrator",
      subagentIds: [SUBAGENT_ID],
      modelId: "gpt-4o",
      subagentPrompt: "Delegate carefully",
      knowledgebaseIds: [SUBAGENT_ID],
      avatar: "https://example.com/avatar.png",
    });
    expect(res.ok).toBe(true);
    expect(mockValidateTargetSubagentIds).toHaveBeenCalledWith("user-1", [
      SUBAGENT_ID,
    ]);
  });

  it("returns validation failure when validateTargetSubagentIds rejects", async () => {
    mockValidateTargetSubagentIds.mockResolvedValueOnce({
      ok: false,
      error: {
        code: ERROR_CODE.INVALID_INPUT,
        message: "Target is an orchestrator",
      },
    });
    const res = await createAgent({
      name: "Bad",
      subagentIds: [SUBAGENT_ID],
    });
    expect(res).toEqual({
      ok: false,
      error: {
        code: ERROR_CODE.INVALID_INPUT,
        message: "Target is an orchestrator",
      },
    });
    expect(chainable.insert).not.toHaveBeenCalled();
  });

  it("returns INVALID_INPUT on invalid schema payload", async () => {
    const res = await createAgent({ name: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
    }
  });

  it("returns UNAUTHORIZED when session is missing", async () => {
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await createAgent({ name: "Test" });
    expect(res).toEqual({
      ok: false,
      error: { code: ERROR_CODE.UNAUTHORIZED, message: "Unauthorized" },
    });
  });
});

describe("updateAgent", () => {
  it("rejects modifying a built-in agent", async () => {
    const res = await updateAgent("builtin:researcher", { name: "Hacked" });
    expect(res).toEqual({
      ok: false,
      error: {
        code: ERROR_CODE.INVALID_INPUT,
        message: "Built-in agents cannot be modified",
      },
    });
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("rejects invalid UUID", async () => {
    const res = await updateAgent("not-a-uuid", { name: "New" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
    }
  });

  it("rejects invalid update payload", async () => {
    const res = await updateAgent(AGENT_ID, {
      guardrails: { maxSteps: 99, scratchpadAccess: "read_write", isolateTools: true },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
    }
  });

  it("validates both Rule 1 and Rule 2 when setting non-empty subagentIds", async () => {
    chainable.returning.mockResolvedValueOnce([
      { ...AGENT_ROW, subagentIds: [SUBAGENT_ID] },
    ]);
    const res = await updateAgent(AGENT_ID, {
      name: "Updated",
      description: "Desc",
      prompt: "Prompt",
      subagentPrompt: "Sub",
      modelId: "gpt-4o",
      knowledgebaseIds: [SUBAGENT_ID],
      tools: ["search_knowledge_base"],
      skillMode: "specific",
      skillIds: ["s1"],
      promptMode: "none",
      promptIds: [],
      subagentIds: [SUBAGENT_ID],
      guardrails: {
        maxSteps: 5,
        scratchpadAccess: "read_only",
        isolateTools: false,
      },
      avatar: null,
    });
    expect(res.ok).toBe(true);
    expect(mockValidateTargetSubagentIds).toHaveBeenCalledWith(
      "user-1",
      [SUBAGENT_ID],
      AGENT_ID,
    );
    expect(mockValidateAgentCanBecomeOrchestrator).toHaveBeenCalledWith(
      "user-1",
      AGENT_ID,
    );
  });

  it("fails when validateTargetSubagentIds fails during update", async () => {
    mockValidateTargetSubagentIds.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.INVALID_INPUT, message: "Self link" },
    });
    const res = await updateAgent(AGENT_ID, { subagentIds: [AGENT_ID] });
    expect(res.ok).toBe(false);
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("fails when validateAgentCanBecomeOrchestrator fails during update", async () => {
    mockValidateAgentCanBecomeOrchestrator.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.INVALID_INPUT, message: "Already linked" },
    });
    const res = await updateAgent(AGENT_ID, { subagentIds: [SUBAGENT_ID] });
    expect(res.ok).toBe(false);
    expect(chainable.update).not.toHaveBeenCalled();
  });

  it("allows clearing subagentIds to empty array without Rule 2 check", async () => {
    chainable.returning.mockResolvedValueOnce([AGENT_ROW]);
    const res = await updateAgent(AGENT_ID, { subagentIds: [] });
    expect(res.ok).toBe(true);
    expect(mockValidateTargetSubagentIds).not.toHaveBeenCalled();
    expect(mockValidateAgentCanBecomeOrchestrator).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when agent does not exist", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    const res = await updateAgent(AGENT_ID, { name: "Ghost" });
    expect(res).toEqual({
      ok: false,
      error: { code: ERROR_CODE.NOT_FOUND, message: "Not Found" },
    });
  });
});

describe("deleteAgent", () => {
  it("returns deletedCount 0 when given an empty array", async () => {
    const res = await deleteAgent([]);
    expect(res).toEqual({ ok: true, value: { deletedCount: 0 } });
    expect(chainable.transaction).not.toHaveBeenCalled();
  });

  it("rejects deleting a built-in agent", async () => {
    const res = await deleteAgent("builtin:worker");
    expect(res).toEqual({
      ok: false,
      error: {
        code: ERROR_CODE.INVALID_INPUT,
        message: "Built-in agents cannot be deleted",
      },
    });
    expect(chainable.transaction).not.toHaveBeenCalled();
  });

  it("deletes agent and unbinds chat, agent, project, transformAgent, skill, and prompt references in transaction", async () => {
    chainable.returning.mockResolvedValueOnce([{ id: AGENT_ID }]);
    const res = await deleteAgent(AGENT_ID);
    expect(res).toEqual({ ok: true, value: { deletedCount: 1 } });
    expect(chainable.transaction).toHaveBeenCalledTimes(1);
    expect(chainable.delete).toHaveBeenCalledTimes(1);
    // 1 chat unbind + 5 array_remove unbinds (agent, project, transformAgent, skill, prompt)
    expect(chainable.update).toHaveBeenCalledTimes(6);
  });

  it("returns NOT_FOUND when no owned agent was deleted", async () => {
    chainable.returning.mockResolvedValueOnce([]);
    const res = await deleteAgent(AGENT_ID);
    expect(res).toEqual({
      ok: false,
      error: { code: ERROR_CODE.NOT_FOUND, message: "Not Found" },
    });
  });
});

describe("listAgents", () => {
  it("returns owned agents with computed usedByCount across agents, projects, and transformAgents", async () => {
    chainable.orderBy.mockResolvedValueOnce([
      AGENT_ROW,
      { ...AGENT_ROW, id: SUBAGENT_ID, name: "Leaf" },
    ]);
    // 2 additional select().from().where() calls for project and transformAgent
    chainable.where
      .mockImplementationOnce(() => chainable) // first query: agent (chains to orderBy)
      .mockResolvedValueOnce([{ subagentIds: [SUBAGENT_ID] }]) // project
      .mockResolvedValueOnce([{ subagentIds: [SUBAGENT_ID] }]); // transformAgent

    const res = await listAgents();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toHaveLength(2);
      expect(res.value[0].usedByCount).toBe(0);
      expect(res.value[1].usedByCount).toBe(2);
    }
  });

  it("counts references from parent agents as well", async () => {
    const parentAgent = { ...AGENT_ROW, subagentIds: [SUBAGENT_ID] };
    const leafAgent = { ...AGENT_ROW, id: SUBAGENT_ID, name: "Leaf" };
    chainable.orderBy.mockResolvedValueOnce([parentAgent, leafAgent]);
    chainable.where
      .mockImplementationOnce(() => chainable)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await listAgents();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value[1].usedByCount).toBe(1);
    }
  });
});

describe("renameAgent", () => {
  it("rejects renaming a built-in agent", async () => {
    const res = await renameAgent("builtin:planner", "New Name");
    expect(res).toEqual({
      ok: false,
      error: {
        code: ERROR_CODE.INVALID_INPUT,
        message: "Built-in agents cannot be modified",
      },
    });
  });

  it("renames a custom agent", async () => {
    chainable.returning.mockResolvedValueOnce([
      { ...AGENT_ROW, name: "Renamed" },
    ]);
    const res = await renameAgent(AGENT_ID, "Renamed");
    expect(res).toEqual({
      ok: true,
      value: { ...AGENT_ROW, name: "Renamed" },
    });
  });
});
