import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.from = vi.fn().mockReturnValue(c);
  c.where = vi.fn().mockReturnValue(c);
  c.orderBy = vi.fn().mockReturnValue(c);
  c.limit = vi.fn().mockReturnValue(c);
  c.offset = vi.fn().mockReturnValue(c);
  c.update = vi.fn().mockReturnValue(c);
  c.set = vi.fn().mockReturnValue(c);
  c.delete = vi.fn().mockReturnValue(c);
  c.returning = vi.fn().mockReturnValue(c);
  c.$dynamic = vi.fn().mockReturnValue(c);
  c.transaction = vi.fn(async (cb: any) => cb(c));
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const mockRequireSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

import { deleteResourceWithUnbind } from "@/lib/db/delete-resource-with-unbind";
import { getOwnedResource } from "@/lib/db/get-owned-resource";
import { listOwnedResources } from "@/lib/db/utils/list-owned-resources";
import { verifyOwnership } from "@/lib/db/verify-ownership";

describe("lib/db helpers", () => {
  const mockTable = {
    id: "id_col",
    userId: "user_id_col",
    updatedAt: "updated_at_col",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.orderBy.mockReturnValue(chainable);
    chainable.limit.mockReturnValue(chainable);
    chainable.offset.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
    chainable.$dynamic.mockReturnValue(chainable);
    chainable.transaction.mockImplementation(async (cb: any) => cb(chainable));

    mockRequireSession.mockResolvedValue({
      user: { id: "user-123" },
    });
  });

  describe("verifyOwnership", () => {
    it("returns row when owned by user", () => {
      const row = { id: "1", userId: "user-123" };
      expect(verifyOwnership(row, "user-123")).toBe(row);
    });

    it("returns row when userId param is omitted", () => {
      const row = { id: "1", userId: "user-123" };
      expect(verifyOwnership(row)).toBe(row);
    });

    it("throws Not Found when row is null or undefined", () => {
      expect(() => verifyOwnership(null, "user-123")).toThrow("Not Found");
      expect(() => verifyOwnership(undefined, "user-123")).toThrow("Not Found");
    });

    it("throws Not Found when userId does not match", () => {
      const row = { id: "1", userId: "other-user" };
      expect(() => verifyOwnership(row, "user-123")).toThrow("Not Found");
    });
  });

  describe("getOwnedResource", () => {
    it("selects and verifies ownership successfully", async () => {
      const row = { id: "res-1", userId: "user-123" };
      chainable.where.mockResolvedValueOnce([row]);

      const result = await getOwnedResource(mockTable, "res-1", "user-123");
      expect(result).toEqual(row);
    });

    it("throws Not Found when resource not returned from db", async () => {
      chainable.where.mockResolvedValueOnce([]);

      await expect(
        getOwnedResource(mockTable, "res-1", "user-123"),
      ).rejects.toThrow("Not Found");
    });
  });

  describe("deleteResourceWithUnbind", () => {
    it("unbinds from table with userId and deletes resource", async () => {
      const unbindTable = {
        userId: "user_col",
        projectId: "project_id_col",
      };
      chainable.returning.mockResolvedValueOnce([{ id: "res-1" }]);

      const result = await deleteResourceWithUnbind(
        mockTable,
        "res-1",
        "user-123",
        { table: unbindTable, field: "projectId" },
      );

      expect(result).toEqual([{ id: "res-1" }]);
      expect(chainable.update).toHaveBeenCalledWith(unbindTable);
      expect(chainable.set).toHaveBeenCalledWith({ projectId: null });
      expect(chainable.delete).toHaveBeenCalledWith(mockTable);
    });

    it("unbinds from table without userId and handles array of IDs", async () => {
      const unbindTable = {
        projectId: "project_id_col",
      };
      chainable.returning.mockResolvedValueOnce([{ id: "res-1" }, { id: "res-2" }]);

      const result = await deleteResourceWithUnbind(
        mockTable,
        ["res-1", "res-2"],
        "user-123",
        { table: unbindTable, field: "projectId" },
      );

      expect(result).toHaveLength(2);
    });
  });

  describe("listOwnedResources", () => {
    it("lists resources with default ordering", async () => {
      const rows = [{ id: "1", userId: "user-123" }];
      chainable.where.mockReturnValueOnce(chainable);
      chainable.orderBy.mockResolvedValueOnce(rows);

      const result = await listOwnedResources(mockTable);
      expect(result).toEqual(rows);
    });

    it("supports custom array orderBy, limit, and offset", async () => {
      const rows = [{ id: "1" }];
      chainable.offset.mockResolvedValueOnce(rows);

      const result = await listOwnedResources(mockTable, {
        orderBy: (t: any) => ["col1", "col2"] as any,
        limit: 10,
        offset: 5,
      });

      expect(chainable.limit).toHaveBeenCalledWith(10);
      expect(chainable.offset).toHaveBeenCalledWith(5);
      expect(result).toEqual(rows);
    });

    it("supports custom single SQL orderBy", async () => {
      const rows = [{ id: "2" }];
      chainable.orderBy.mockResolvedValueOnce(rows);

      const result = await listOwnedResources(mockTable, {
        orderBy: (t: any) => "single-order-col" as any,
      });

      expect(chainable.orderBy).toHaveBeenCalledWith("single-order-col");
      expect(result).toEqual(rows);
    });

    it("handles table without updatedAt when orderBy is not provided", async () => {
      const tableWithoutUpdatedAt = { id: "id", userId: "userId" };
      const rows = [{ id: "3" }];
      chainable.$dynamic.mockResolvedValueOnce(rows);

      const result = await listOwnedResources(tableWithoutUpdatedAt);
      expect(result).toEqual(rows);
    });
  });
});

