import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c: any = {};
  c.update = vi.fn().mockReturnValue(c);
  c.set = vi.fn().mockReturnValue(c);
  c.where = vi.fn().mockReturnValue(c);
  c.delete = vi.fn().mockReturnValue(c);
  c.returning = vi.fn().mockReturnValue(c);
  c.transaction = vi.fn(async (cb: any) => cb(c));
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

import {
  deleteResourceWithUnbind,
  resolveFieldKey,
} from "@/lib/db/delete-resource-with-unbind";
import { assistant, chat, project } from "@/drizzle/schema";

describe("deleteResourceWithUnbind", () => {
  const mockResourceTable = {
    id: "res_id_col",
    userId: "res_user_id_col",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
    chainable.transaction.mockImplementation(async (cb: any) => cb(chainable));
  });

  describe("resolveFieldKey", () => {
    it("returns string field directly", () => {
      expect(resolveFieldKey(chat, "projectId")).toBe("projectId");
      expect(resolveFieldKey({}, "customField")).toBe("customField");
    });

    it("resolves property key for chat.projectId column object", () => {
      expect(resolveFieldKey(chat, chat.projectId)).toBe("projectId");
    });

    it("resolves property key for chat.assistantId column object", () => {
      expect(resolveFieldKey(chat, chat.assistantId)).toBe("assistantId");
    });

    it("resolves property key from plain mock table", () => {
      const mockTable = { projectId: { name: "project_id" } };
      expect(resolveFieldKey(mockTable, mockTable.projectId)).toBe("projectId");
    });

    it("falls back to field.name if key cannot be matched on table", () => {
      const col = { name: "fallback_col" };
      expect(resolveFieldKey({}, col)).toBe("fallback_col");
    });
  });

  describe("database operations", () => {
    it("unbinds chat.projectId correctly without '[object Object]' key", async () => {
      chainable.returning.mockResolvedValueOnce([{ id: "proj-1" }]);

      const result = await deleteResourceWithUnbind(
        project,
        "proj-1",
        "user-1",
        { table: chat, field: chat.projectId },
      );

      expect(result).toEqual([{ id: "proj-1" }]);
      expect(chainable.update).toHaveBeenCalledWith(chat);
      expect(chainable.set).toHaveBeenCalledWith({ projectId: null });
      expect(chainable.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ "[object Object]": null }),
      );
      expect(chainable.delete).toHaveBeenCalledWith(project);
    });

    it("unbinds chat.assistantId correctly without '[object Object]' key", async () => {
      chainable.returning.mockResolvedValueOnce([{ id: "asst-1" }]);

      const result = await deleteResourceWithUnbind(
        assistant,
        "asst-1",
        "user-1",
        { table: chat, field: chat.assistantId },
      );

      expect(result).toEqual([{ id: "asst-1" }]);
      expect(chainable.update).toHaveBeenCalledWith(chat);
      expect(chainable.set).toHaveBeenCalledWith({ assistantId: null });
      expect(chainable.delete).toHaveBeenCalledWith(assistant);
    });

    it("supports string field name for backward compatibility", async () => {
      chainable.returning.mockResolvedValueOnce([{ id: "res-1" }]);

      const unbindTable = {
        userId: "user_col",
        projectId: "project_id_col",
      };

      const result = await deleteResourceWithUnbind(
        mockResourceTable,
        "res-1",
        "user-1",
        { table: unbindTable, field: "projectId" },
      );

      expect(result).toEqual([{ id: "res-1" }]);
      expect(chainable.set).toHaveBeenCalledWith({ projectId: null });
    });

    it("handles multiple IDs in array", async () => {
      chainable.returning.mockResolvedValueOnce([
        { id: "proj-1" },
        { id: "proj-2" },
      ]);

      const result = await deleteResourceWithUnbind(
        project,
        ["proj-1", "proj-2"],
        "user-1",
        { table: chat, field: chat.projectId },
      );

      expect(result).toHaveLength(2);
      expect(chainable.set).toHaveBeenCalledWith({ projectId: null });
    });

    it("propagates transaction errors", async () => {
      chainable.transaction.mockRejectedValueOnce(new Error("Transaction failed"));

      await expect(
        deleteResourceWithUnbind(project, "proj-1", "user-1", {
          table: chat,
          field: chat.projectId,
        }),
      ).rejects.toThrow("Transaction failed");
    });
  });
});
