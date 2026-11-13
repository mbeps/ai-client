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

const mockDb = vi.hoisted(() => {
  const selectWhere = vi.fn().mockResolvedValue([]);
  const selectLimit = vi.fn().mockResolvedValue([]);
  const selectFrom = vi.fn().mockImplementation(() => ({
    where: selectWhere,
  }));
  const select = vi.fn().mockImplementation(() => ({
    from: selectFrom,
  }));
  return { select, selectFrom, selectWhere, selectLimit };
});

vi.mock("@/drizzle/db", () => ({ db: mockDb }));

import {
  validateAgentCanBecomeOrchestrator,
  validateTargetSubagentIds,
} from "@/lib/agents/validate-subagent-links";
import { ERROR_CODE } from "@/lib/error/error-code";

const USER_ID = "user-1";
const SELF_ID = "11111111-1111-4111-8111-111111111111";
const LEAF_ID = "22222222-2222-4222-8222-222222222222";
const ORCH_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.select.mockImplementation(() => ({
    from: mockDb.selectFrom,
  }));
  mockDb.selectFrom.mockImplementation(() => ({
    where: mockDb.selectWhere,
  }));
  mockDb.selectWhere.mockResolvedValue([]);
  mockDb.selectLimit.mockResolvedValue([]);
});

describe("validateTargetSubagentIds", () => {
  it("returns ok immediately when targetSubagentIds is empty", async () => {
    const res = await validateTargetSubagentIds(USER_ID, [], SELF_ID);
    expect(res).toEqual({ ok: true, value: undefined });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("rejects self-referencing subagent link", async () => {
    const res = await validateTargetSubagentIds(USER_ID, [SELF_ID], SELF_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(res.error.message).toMatch(/itself/i);
    }
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("rejects non-linkable built-in agent builtin:kb-reader", async () => {
    const res = await validateTargetSubagentIds(USER_ID, ["builtin:kb-reader"]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(res.error.message).toContain("builtin:kb-reader");
    }
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("accepts linkable built-in IDs without querying the database", async () => {
    const res = await validateTargetSubagentIds(USER_ID, [
      "builtin:researcher",
      "builtin:planner",
    ]);
    expect(res).toEqual({ ok: true, value: undefined });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("rejects missing or unowned custom agent UUIDs", async () => {
    mockDb.selectWhere.mockResolvedValueOnce([]);
    const res = await validateTargetSubagentIds(USER_ID, [LEAF_ID]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(res.error.message).toMatch(/do not exist/i);
    }
  });

  it("rejects target custom agent that already has child subagents (Rule 1)", async () => {
    mockDb.selectWhere.mockResolvedValueOnce([
      { id: ORCH_ID, name: "Boss Agent", subagentIds: [LEAF_ID] },
    ]);
    const res = await validateTargetSubagentIds(USER_ID, [ORCH_ID]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(res.error.message).toContain("Boss Agent");
      expect(res.error.message).toMatch(/Orchestrator/i);
    }
  });

  it("accepts valid custom leaf agents (deduplicating repeated IDs)", async () => {
    mockDb.selectWhere.mockResolvedValueOnce([
      { id: LEAF_ID, name: "Leaf Agent", subagentIds: [] },
    ]);
    const res = await validateTargetSubagentIds(USER_ID, [
      "builtin:worker",
      LEAF_ID,
      LEAF_ID,
    ]);
    expect(res).toEqual({ ok: true, value: undefined });
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });
});

describe("validateAgentCanBecomeOrchestrator", () => {
  beforeEach(() => {
    mockDb.selectWhere.mockImplementation(() => ({
      limit: mockDb.selectLimit,
    }));
  });

  it("returns ok when agent is not referenced in any parent", async () => {
    mockDb.selectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await validateAgentCanBecomeOrchestrator(USER_ID, SELF_ID);
    expect(res).toEqual({ ok: true, value: undefined });
  });

  it("rejects when agent is referenced in another agent's subagentIds (Rule 2)", async () => {
    mockDb.selectLimit
      .mockResolvedValueOnce([{ id: ORCH_ID }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const res = await validateAgentCanBecomeOrchestrator(USER_ID, SELF_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(res.error.message).toMatch(/linked as a subagent/i);
    }
  });

  it("rejects when agent is referenced in a project's subagentIds (Rule 2)", async () => {
    mockDb.selectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "proj-1" }])
      .mockResolvedValueOnce([]);
    const res = await validateAgentCanBecomeOrchestrator(USER_ID, SELF_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
    }
  });

  it("rejects when agent is referenced in a transformAgent's subagentIds (Rule 2)", async () => {
    mockDb.selectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "tf-1" }]);
    const res = await validateAgentCanBecomeOrchestrator(USER_ID, SELF_ID);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
    }
  });
});
