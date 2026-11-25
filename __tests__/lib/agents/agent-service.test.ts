import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import { ERROR_CODE } from "@/lib/error/error-code";

const {
  mockInsertReturning,
  mockInsertValues,
  mockUpdateReturning,
  mockUpdateWhere,
  mockUpdateSet,
  mockFilterOwnedKbIds,
  mockValidateTargetSubagentIds,
  mockValidateAgentCanBecomeOrchestrator,
  mockWithSubagentLinkLock,
  mockDb,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockFilterOwnedKbIds = vi.fn();
  const mockValidateTargetSubagentIds = vi.fn();
  const mockValidateAgentCanBecomeOrchestrator = vi.fn();
  const mockWithSubagentLinkLock = vi.fn();
  const mockDb = {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
  };
  return {
    mockInsertReturning,
    mockInsertValues,
    mockUpdateReturning,
    mockUpdateWhere,
    mockUpdateSet,
    mockFilterOwnedKbIds,
    mockValidateTargetSubagentIds,
    mockValidateAgentCanBecomeOrchestrator,
    mockWithSubagentLinkLock,
    mockDb,
  };
});

vi.mock("@/drizzle/db", () => ({ db: mockDb }));
vi.mock("@/lib/knowledgebases/filter-owned-kb-ids", () => ({
  filterOwnedKbIds: (...args: unknown[]) => mockFilterOwnedKbIds(...args),
}));
vi.mock("@/lib/agents/validate-subagent-links", () => ({
  validateTargetSubagentIds: (...args: unknown[]) =>
    mockValidateTargetSubagentIds(...args),
  validateAgentCanBecomeOrchestrator: (...args: unknown[]) =>
    mockValidateAgentCanBecomeOrchestrator(...args),
  withSubagentLinkLock: (...args: unknown[]) =>
    mockWithSubagentLinkLock(...args),
}));

import {
  createAgentForUser,
  updateAgentForUser,
} from "@/lib/agents/agent-service";

const USER_ID = "user-1";
const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const KB_ID = "22222222-2222-4222-8222-222222222222";
const SUB_ID = "33333333-3333-4333-8333-333333333333";

const SAMPLE_AGENT = {
  id: AGENT_ID,
  userId: USER_ID,
  name: "Research Agent",
  description: null,
  prompt: null,
  subagentPrompt: null,
  modelId: null,
  reasoningEffort: null,
  knowledgebaseIds: [],
  tools: [...DEFAULT_ENABLED_TOOLS],
  skillMode: "dynamic" as const,
  skillIds: [],
  promptMode: "all" as const,
  promptIds: [],
  subagentIds: [],
  guardrails: DEFAULT_AGENT_GUARDRAILS,
  avatar: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("agent-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilterOwnedKbIds.mockResolvedValue([KB_ID]);
    mockValidateTargetSubagentIds.mockResolvedValue({ ok: true, value: true });
    mockValidateAgentCanBecomeOrchestrator.mockResolvedValue({
      ok: true,
      value: true,
    });
    mockWithSubagentLinkLock.mockImplementation(
      async (_uid: string, cb: (tx: typeof mockDb) => Promise<unknown>) =>
        cb(mockDb),
    );
  });

  describe("createAgentForUser", () => {
    it("creates an agent with defaults", async () => {
      mockInsertReturning.mockResolvedValueOnce([SAMPLE_AGENT]);

      const res = await createAgentForUser(USER_ID, { name: "Research Agent" });
      expect(res).toEqual({ ok: true, value: SAMPLE_AGENT });
    });

    it("fails on invalid schema input", async () => {
      const res = await createAgentForUser(USER_ID, { name: "" });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: ERROR_CODE.INVALID_INPUT,
          issues: expect.any(Array),
        }),
      });

      const rootErr = await createAgentForUser(USER_ID, null as any);
      expect(rootErr.ok).toBe(false);
    });

    it("rejects unowned knowledgebaseIds", async () => {
      mockFilterOwnedKbIds.mockResolvedValueOnce([]);

      const res = await createAgentForUser(USER_ID, {
        name: "Agent",
        knowledgebaseIds: [KB_ID],
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
    });

    it("enforces subagent link validation under lock", async () => {
      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: false,
        error: { code: ERROR_CODE.INVALID_INPUT, message: "Bad subagent" },
      });

      const failRes = await createAgentForUser(USER_ID, {
        name: "Agent",
        subagentIds: [SUB_ID],
      });
      expect(failRes.ok).toBe(false);

      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: true,
        value: true,
      });
      mockInsertReturning.mockResolvedValueOnce([SAMPLE_AGENT]);

      const okRes = await createAgentForUser(USER_ID, {
        name: "Agent",
        subagentIds: [SUB_ID],
      });
      expect(okRes).toEqual({ ok: true, value: SAMPLE_AGENT });
    });
  });

  describe("updateAgentForUser", () => {
    it("rejects built-in agent IDs", async () => {
      const res = await updateAgentForUser(USER_ID, "builtin:researcher", {
        name: "Hacked",
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: ERROR_CODE.INVALID_INPUT,
          message: "Built-in agents cannot be modified",
        }),
      });
    });

    it("rejects non-UUID id", async () => {
      const res = await updateAgentForUser(USER_ID, "bad-id", { name: "X" });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.INVALID_INPUT }),
      });
    });

    it("rejects invalid update schema payload", async () => {
      const res = await updateAgentForUser(USER_ID, AGENT_ID, { name: "" });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: ERROR_CODE.INVALID_INPUT,
          issues: expect.any(Array),
        }),
      });
    });

    it("rejects unowned knowledgebaseIds on update", async () => {
      mockFilterOwnedKbIds.mockResolvedValueOnce([]);

      const res = await updateAgentForUser(USER_ID, AGENT_ID, {
        knowledgebaseIds: [KB_ID],
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
    });

    it("enforces both 2-layer rules when subagentIds is non-empty", async () => {
      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: false,
        error: { code: ERROR_CODE.INVALID_INPUT, message: "Rule 1" },
      });
      const r1 = await updateAgentForUser(USER_ID, AGENT_ID, {
        subagentIds: [SUB_ID],
      });
      expect(r1.ok).toBe(false);

      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: true,
        value: true,
      });
      mockValidateAgentCanBecomeOrchestrator.mockResolvedValueOnce({
        ok: false,
        error: { code: ERROR_CODE.INVALID_INPUT, message: "Rule 2" },
      });
      const r2 = await updateAgentForUser(USER_ID, AGENT_ID, {
        subagentIds: [SUB_ID],
      });
      expect(r2.ok).toBe(false);

      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: true,
        value: true,
      });
      mockValidateAgentCanBecomeOrchestrator.mockResolvedValueOnce({
        ok: true,
        value: true,
      });
      mockUpdateReturning.mockResolvedValueOnce([SAMPLE_AGENT]);

      const okRes = await updateAgentForUser(USER_ID, AGENT_ID, {
        name: "Updated",
        description: "Desc",
        prompt: "P",
        subagentPrompt: "SP",
        modelId: "m1",
        reasoningEffort: "high",
        knowledgebaseIds: [KB_ID],
        tools: [],
        skillMode: "specific",
        skillIds: ["s1"],
        promptMode: "none",
        promptIds: ["p1"],
        subagentIds: [SUB_ID],
        guardrails: DEFAULT_AGENT_GUARDRAILS,
        avatar: "https://example.com/bot.png",
      });
      expect(okRes).toEqual({ ok: true, value: SAMPLE_AGENT });
    });

    it("returns NOT_FOUND when agent does not exist", async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);
      const res = await updateAgentForUser(USER_ID, AGENT_ID, {
        name: "Updated",
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
    });
  });
});
