import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { ERROR_CODE } from "@/lib/error/error-code";

const {
  mockInsertReturning,
  mockInsertValues,
  mockUpdateReturning,
  mockUpdateWhere,
  mockUpdateSet,
  mockFilterOwnedKbIds,
  mockValidateTargetSubagentIds,
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
  withSubagentLinkLock: (...args: unknown[]) =>
    mockWithSubagentLinkLock(...args),
}));

import {
  createProjectForUser,
  updateProjectForUser,
} from "@/lib/projects/project-service";

const USER_ID = "user-1";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const KB_ID = "22222222-2222-4222-8222-222222222222";
const SUB_ID = "33333333-3333-4333-8333-333333333333";

const SAMPLE_PROJECT = {
  id: PROJECT_ID,
  userId: USER_ID,
  name: "Test Project",
  description: null,
  globalPrompt: null,
  tools: [...DEFAULT_ENABLED_TOOLS],
  skillMode: "dynamic" as const,
  skillIds: [],
  promptMode: "all" as const,
  promptIds: [],
  subagentIds: [],
  knowledgebaseId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("project-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilterOwnedKbIds.mockResolvedValue([KB_ID]);
    mockValidateTargetSubagentIds.mockResolvedValue({ ok: true, value: true });
    mockWithSubagentLinkLock.mockImplementation(
      async (_uid: string, cb: (tx: typeof mockDb) => Promise<unknown>) =>
        cb(mockDb),
    );
  });

  describe("createProjectForUser", () => {
    it("creates a project with defaults and returns ok", async () => {
      mockInsertReturning.mockResolvedValueOnce([SAMPLE_PROJECT]);

      const res = await createProjectForUser(USER_ID, { name: "Test Project" });

      expect(res).toEqual({ ok: true, value: SAMPLE_PROJECT });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Project",
          tools: [...DEFAULT_ENABLED_TOOLS],
          userId: USER_ID,
        }),
      );
    });

    it("fails with INVALID_INPUT on schema error", async () => {
      const res = await createProjectForUser(USER_ID, { name: "" });

      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: ERROR_CODE.INVALID_INPUT,
          issues: expect.any(Array),
        }),
      });
    });

    it("verifies knowledgebaseId ownership and returns NOT_FOUND if not owned", async () => {
      mockFilterOwnedKbIds.mockResolvedValueOnce([]);

      const res = await createProjectForUser(USER_ID, {
        name: "Test Project",
        knowledgebaseId: KB_ID,
      });

      expect(mockFilterOwnedKbIds).toHaveBeenCalledWith(USER_ID, [KB_ID]);
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("enforces subagent link lock and target validation when subagentIds provided", async () => {
      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: false,
        error: { code: ERROR_CODE.INVALID_INPUT, message: "Invalid subagent" },
      });

      const failed = await createProjectForUser(USER_ID, {
        name: "Test",
        subagentIds: [SUB_ID],
      });
      expect(failed.ok).toBe(false);
      expect(mockWithSubagentLinkLock).toHaveBeenCalled();

      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: true,
        value: true,
      });
      mockInsertReturning.mockResolvedValueOnce([SAMPLE_PROJECT]);

      const okRes = await createProjectForUser(USER_ID, {
        name: "Test",
        subagentIds: [SUB_ID],
      });
      expect(okRes).toEqual({ ok: true, value: SAMPLE_PROJECT });
    });
  });

  describe("updateProjectForUser", () => {
    it("rejects invalid UUID id", async () => {
      const res = await updateProjectForUser(USER_ID, "not-a-uuid", {
        name: "Updated",
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.INVALID_INPUT }),
      });
    });

    it("rejects invalid update payload", async () => {
      const res = await updateProjectForUser(USER_ID, PROJECT_ID, {
        name: "",
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: ERROR_CODE.INVALID_INPUT,
          issues: expect.any(Array),
        }),
      });
    });

    it("rejects unowned knowledgebaseId on update", async () => {
      mockFilterOwnedKbIds.mockResolvedValueOnce([]);

      const res = await updateProjectForUser(USER_ID, PROJECT_ID, {
        knowledgebaseId: KB_ID,
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
    });

    it("returns NOT_FOUND when project does not exist or belongs to another user", async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);

      const res = await updateProjectForUser(USER_ID, PROJECT_ID, {
        name: "Updated",
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
    });

    it("updates all fields including subagentIds under lock", async () => {
      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: false,
        error: { code: ERROR_CODE.INVALID_INPUT, message: "Bad subagent" },
      });

      const failRes = await updateProjectForUser(USER_ID, PROJECT_ID, {
        subagentIds: [SUB_ID],
      });
      expect(failRes.ok).toBe(false);

      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: true,
        value: true,
      });
      const updated = { ...SAMPLE_PROJECT, name: "New Name", subagentIds: [SUB_ID] };
      mockUpdateReturning.mockResolvedValueOnce([updated]);

      const okRes = await updateProjectForUser(USER_ID, PROJECT_ID, {
        name: "New Name",
        description: "Desc",
        globalPrompt: "Prompt",
        tools: [],
        skillMode: "specific",
        skillIds: ["s1"],
        promptMode: "none",
        promptIds: ["p1"],
        subagentIds: [SUB_ID],
        knowledgebaseId: KB_ID,
      });
      expect(okRes).toEqual({ ok: true, value: updated });
    });
  });
});
