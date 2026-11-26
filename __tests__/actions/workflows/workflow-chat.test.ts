import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";

const mockRequireSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockSelectOrderBy = vi.hoisted(() => vi.fn());
const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockInsertValues = vi.hoisted(() =>
  vi.fn(() => ({ returning: mockInsertReturning })),
);

vi.mock("@/drizzle/db", () => {
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    })),
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
  };
  return {
    db: mockDb,
  };
});

import {
  createWorkflowChat,
  getOrCreateWorkflowChat,
  listWorkflowChats,
} from "@/actions/workflows/get-or-create-workflow-chat";

describe("workflow chat actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  describe("getOrCreateWorkflowChat", () => {
    it("returns NOT_FOUND when workflow is missing or owned by another user", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const result = await getOrCreateWorkflowChat("wf-foreign");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      }
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("returns existing builder chat when one already exists (idempotent)", async () => {
      const existingChat = {
        id: "chat-existing",
        title: "Builder: My Flow",
        userId: "user-1",
        workflowId: "wf-1",
      };
      mockSelectWhere
        .mockResolvedValueOnce([{ id: "wf-1", name: "My Flow" }])
        .mockReturnValueOnce({ orderBy: mockSelectOrderBy });
      mockSelectOrderBy.mockReturnValueOnce({ limit: mockSelectLimit });
      mockSelectLimit.mockResolvedValueOnce([existingChat]);

      const result = await getOrCreateWorkflowChat("wf-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(existingChat);
      }
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("creates a new builder chat with workflowId when none exists", async () => {
      const createdChat = {
        id: "chat-new",
        title: "Builder: My Flow",
        userId: "user-1",
        workflowId: "wf-1",
      };
      mockSelectWhere
        .mockResolvedValueOnce([{ id: "wf-1", name: "My Flow" }])
        .mockReturnValueOnce({ orderBy: mockSelectOrderBy });
      mockSelectOrderBy.mockReturnValueOnce({ limit: mockSelectLimit });
      mockSelectLimit.mockResolvedValueOnce([]);
      mockInsertReturning.mockResolvedValueOnce([createdChat]);

      const result = await getOrCreateWorkflowChat("wf-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(createdChat);
      }
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          workflowId: "wf-1",
          title: "Builder: My Flow",
        }),
      );
    });
  });

  describe("createWorkflowChat", () => {
    it("returns NOT_FOUND when workflow is not owned by user", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const result = await createWorkflowChat("wf-foreign");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      }
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("creates a fresh builder chat without deleting existing history", async () => {
      const freshChat = {
        id: "chat-fresh",
        title: "Builder: My Flow",
        userId: "user-1",
        workflowId: "wf-1",
      };
      mockSelectWhere.mockResolvedValueOnce([{ id: "wf-1", name: "My Flow" }]);
      mockInsertReturning.mockResolvedValueOnce([freshChat]);

      const result = await createWorkflowChat("wf-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(freshChat);
      }
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          workflowId: "wf-1",
          title: "Builder: My Flow",
        }),
      );
    });
  });

  describe("listWorkflowChats", () => {
    it("returns NOT_FOUND when workflow is not owned by user", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const result = await listWorkflowChats("wf-foreign");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      }
    });

    it("returns all builder chats for the workflow ordered by updatedAt", async () => {
      const rows = [
        { id: "chat-2", title: "Second", workflowId: "wf-1" },
        { id: "chat-1", title: "First", workflowId: "wf-1" },
      ];
      mockSelectWhere
        .mockResolvedValueOnce([{ id: "wf-1", name: "My Flow" }])
        .mockReturnValueOnce({ orderBy: mockSelectOrderBy });
      mockSelectOrderBy.mockResolvedValueOnce(rows);

      const result = await listWorkflowChats("wf-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(rows);
      }
    });
  });
});
