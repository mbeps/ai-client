import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";

const mockRequireSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockInsertValues = vi.hoisted(() =>
  vi.fn(() => ({ returning: mockInsertReturning })),
);
const mockDeleteWhere = vi.hoisted(() => vi.fn());

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    })),
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
    delete: vi.fn(() => ({
      where: mockDeleteWhere,
    })),
  },
}));

import {
  getOrCreateWorkflowChat,
  resetWorkflowChat,
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
        .mockResolvedValueOnce([existingChat]);

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
        .mockResolvedValueOnce([]);
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

  describe("resetWorkflowChat", () => {
    it("returns NOT_FOUND when workflow is not owned by user", async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const result = await resetWorkflowChat("wf-foreign");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      }
      expect(mockDeleteWhere).not.toHaveBeenCalled();
    });

    it("deletes existing builder chat and creates a fresh one", async () => {
      const freshChat = {
        id: "chat-fresh",
        title: "Builder: My Flow",
        userId: "user-1",
        workflowId: "wf-1",
      };
      mockSelectWhere.mockResolvedValueOnce([{ id: "wf-1", name: "My Flow" }]);
      mockDeleteWhere.mockResolvedValueOnce(undefined);
      mockInsertReturning.mockResolvedValueOnce([freshChat]);

      const result = await resetWorkflowChat("wf-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(freshChat);
      }
      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          workflowId: "wf-1",
          title: "Builder: My Flow",
        }),
      );
    });
  });
});
