import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";

const {
  mockSelectWhere,
  mockInsertReturning,
  mockInsertValues,
  mockUpdateReturning,
  mockUpdateWhere,
  mockUpdateSet,
  mockDb,
} = vi.hoisted(() => {
  const mockSelectWhere = vi.fn();
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockDb = {
    select: vi.fn(() => ({ from: mockSelectFrom })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
  };
  return {
    mockSelectWhere,
    mockInsertReturning,
    mockInsertValues,
    mockUpdateReturning,
    mockUpdateWhere,
    mockUpdateSet,
    mockDb,
  };
});

vi.mock("@/drizzle/db", () => ({ db: mockDb }));

import {
  createPromptForUser,
  updatePromptForUser,
} from "@/lib/prompts/prompt-service";

const USER_ID = "user-1";
const PROMPT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const AGENT_ID = "33333333-3333-4333-8333-333333333333";

const SAMPLE_PROMPT = {
  id: PROMPT_ID,
  userId: USER_ID,
  title: "Code Review",
  shortcut: "review",
  content: "Review this code carefully",
  projectIds: [],
  agentIds: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("prompt-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPromptForUser", () => {
    it("creates a global prompt", async () => {
      mockInsertReturning.mockResolvedValueOnce([SAMPLE_PROMPT]);

      const res = await createPromptForUser(USER_ID, {
        title: "Code Review",
        shortcut: "review",
        content: "Review this code carefully",
        projectIds: [],
        agentIds: [],
      });

      expect(res).toEqual({ ok: true, value: SAMPLE_PROMPT });
    });

    it("fails on invalid schema", async () => {
      const res = await createPromptForUser(USER_ID, {
        title: "",
        shortcut: "",
        content: "",
        projectIds: [],
        agentIds: [],
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: ERROR_CODE.INVALID_INPUT,
          issues: expect.any(Array),
        }),
      });

      const rootErr = await createPromptForUser(USER_ID, null as any);
      expect(rootErr.ok).toBe(false);
    });

    it("fails when projectIds are not owned", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await createPromptForUser(USER_ID, {
        title: "Review",
        shortcut: "review",
        content: "Content",
        projectIds: [PROJECT_ID],
        agentIds: [],
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
    });

    it("fails when agentIds are not owned", async () => {
      mockSelectWhere.mockResolvedValueOnce([{ id: PROJECT_ID }]);
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await createPromptForUser(USER_ID, {
        title: "Review",
        shortcut: "review",
        content: "Content",
        projectIds: [PROJECT_ID],
        agentIds: [AGENT_ID],
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
    });

    it("accepts owned projectIds and assistantIds", async () => {
      mockSelectWhere.mockResolvedValueOnce([{ id: PROJECT_ID }]);
      mockSelectWhere.mockResolvedValueOnce([{ id: AGENT_ID }]);
      mockInsertReturning.mockResolvedValueOnce([SAMPLE_PROMPT]);

      const res = await createPromptForUser(USER_ID, {
        title: "Review",
        shortcut: "review",
        content: "Content",
        projectIds: [PROJECT_ID],
        assistantIds: [AGENT_ID],
      } as any);
      expect(res).toEqual({ ok: true, value: SAMPLE_PROMPT });
    });
  });

  describe("updatePromptForUser", () => {
    it("rejects invalid UUID", async () => {
      const res = await updatePromptForUser(USER_ID, "bad", { title: "X" });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.INVALID_INPUT }),
      });
    });

    it("rejects invalid update schema", async () => {
      const res = await updatePromptForUser(USER_ID, PROMPT_ID, {
        title: "",
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: ERROR_CODE.INVALID_INPUT,
          issues: expect.any(Array),
        }),
      });
    });

    it("rejects unowned projectIds or agentIds on update", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);
      const r1 = await updatePromptForUser(USER_ID, PROMPT_ID, {
        projectIds: [PROJECT_ID],
      });
      expect(r1).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });

      mockSelectWhere.mockResolvedValueOnce([]);
      const r2 = await updatePromptForUser(USER_ID, PROMPT_ID, {
        agentIds: [AGENT_ID],
      });
      expect(r2).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
    });

    it("returns NOT_FOUND when prompt row is missing", async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);
      const res = await updatePromptForUser(USER_ID, PROMPT_ID, {
        title: "Updated",
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
    });

    it("updates all fields cleanly", async () => {
      mockSelectWhere.mockResolvedValueOnce([{ id: PROJECT_ID }]);
      mockSelectWhere.mockResolvedValueOnce([{ id: AGENT_ID }]);
      mockUpdateReturning.mockResolvedValueOnce([SAMPLE_PROMPT]);

      const res = await updatePromptForUser(USER_ID, PROMPT_ID, {
        title: "New",
        shortcut: "new",
        content: "New body",
        projectIds: [PROJECT_ID],
        agentIds: [AGENT_ID],
      });
      expect(res).toEqual({ ok: true, value: SAMPLE_PROMPT });
    });
  });
});
