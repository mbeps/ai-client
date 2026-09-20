import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createEntityFactory } from "@/actions/shared/create-entity-factory";
import { deleteEntityFactory } from "@/actions/shared/delete-entity-factory";
import { renameEntityFactory } from "@/actions/shared/rename-entity-factory";
import { updateEntityFactory } from "@/actions/shared/update-entity-factory";

const requireSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

const deleteResourceWithUnbindMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/delete-resource-with-unbind", () => ({
  deleteResourceWithUnbind: deleteResourceWithUnbindMock,
}));

const dbInsertMock = vi.hoisted(() => vi.fn());
const dbDeleteMock = vi.hoisted(() => vi.fn());
const dbUpdateMock = vi.hoisted(() => vi.fn());
vi.mock("@/drizzle/db", () => ({
  db: {
    insert: dbInsertMock,
    delete: dbDeleteMock,
    update: dbUpdateMock,
  },
}));

describe("entity factories", () => {
  const userId = "user-123";
  const mockTable = {
    id: "table.id",
    userId: "table.userId",
    name: "table.name",
    updatedAt: "table.updatedAt",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ user: { id: userId } });
  });

  describe("createEntityFactory", () => {
    const schema = z.object({ title: z.string() });

    it("creates entity with default mapping and logs audit data", async () => {
      const insertedRow = { id: "item-1", title: "My Item", userId };
      const returningMock = vi.fn().mockResolvedValue([insertedRow]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      dbInsertMock.mockReturnValue({ values: valuesMock });

      const auditDataMock = vi.fn().mockReturnValue({ extra: "data" });
      const createAction = createEntityFactory({
        table: mockTable,
        schema,
        auditName: "Item",
        auditData: auditDataMock,
      });

      const result = await createAction({ title: "My Item" });

      expect(result).toEqual(insertedRow);
      expect(valuesMock).toHaveBeenCalledWith({ title: "My Item", userId });
      expect(auditDataMock).toHaveBeenCalledWith(insertedRow);
    });

    it("creates entity with auditName but no auditData", async () => {
      const insertedRow = { id: "item-audit-no-data", title: "Audit No Data", userId };
      const returningMock = vi.fn().mockResolvedValue([insertedRow]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      dbInsertMock.mockReturnValue({ values: valuesMock });

      const createAction = createEntityFactory({
        table: mockTable,
        schema,
        auditName: "Item",
      });

      const result = await createAction({ title: "Audit No Data" });
      expect(result).toEqual(insertedRow);
    });

    it("runs beforeValidate hook and custom mapValues without auditName", async () => {
      const beforeValidateMock = vi.fn().mockResolvedValue(undefined);
      const insertedRow = { id: "item-2", title: "Mapped", customUser: userId };
      const returningMock = vi.fn().mockResolvedValue([insertedRow]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      dbInsertMock.mockReturnValue({ values: valuesMock });

      const createAction = createEntityFactory({
        table: mockTable,
        schema,
        beforeValidate: beforeValidateMock,
        mapValues: (data, uid) => ({ ...data, customUser: uid }),
      });

      const result = await createAction({ title: "Mapped" });

      expect(result).toEqual(insertedRow);
      expect(beforeValidateMock).toHaveBeenCalledWith({ title: "Mapped" }, userId);
      expect(valuesMock).toHaveBeenCalledWith({ title: "Mapped", customUser: userId });
    });
  });

  describe("deleteEntityFactory", () => {
    it("returns 0 deleted count immediately for empty ids array", async () => {
      const deleteAction = deleteEntityFactory({ table: mockTable });
      const result = await deleteAction([]);
      expect(result).toEqual({ deletedCount: 0 });
    });

    it("deletes single entity with unbind and onDelete hook", async () => {
      deleteResourceWithUnbindMock.mockResolvedValue([{ id: "item-1" }]);
      const onDeleteMock = vi.fn().mockResolvedValue(undefined);

      const deleteAction = deleteEntityFactory({
        table: mockTable,
        unbind: { table: "chats", field: "chat.itemId" },
        onDelete: onDeleteMock,
      });

      const result = await deleteAction("item-1");

      expect(result).toEqual({ deletedCount: 1 });
      expect(deleteResourceWithUnbindMock).toHaveBeenCalledWith(
        mockTable,
        ["item-1"],
        userId,
        { table: "chats", field: "chat.itemId" },
      );
      expect(onDeleteMock).toHaveBeenCalledWith(userId, ["item-1"]);
    });

    it("deletes with unbind when onDelete is not configured", async () => {
      deleteResourceWithUnbindMock.mockResolvedValue([{ id: "item-no-hook" }]);

      const deleteAction = deleteEntityFactory({
        table: mockTable,
        unbind: { table: "chats", field: "chat.itemId" },
      });

      const result = await deleteAction("item-no-hook");
      expect(result).toEqual({ deletedCount: 1 });
    });

    it("throws Not Found when unbind deletion yields 0 rows", async () => {
      deleteResourceWithUnbindMock.mockResolvedValue([]);

      const deleteAction = deleteEntityFactory({
        table: mockTable,
        unbind: { table: "chats", field: "chat.itemId" },
      });

      await expect(deleteAction("missing-id")).rejects.toThrow("Not Found");
    });

    it("deletes entities without unbind and calls onDelete hook", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "item-1" }, { id: "item-2" }]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      dbDeleteMock.mockReturnValue({ where: whereMock });

      const onDeleteMock = vi.fn().mockResolvedValue(undefined);
      const deleteAction = deleteEntityFactory({
        table: mockTable,
        onDelete: onDeleteMock,
      });

      const result = await deleteAction(["item-1", "item-2"]);

      expect(result).toEqual({ deletedCount: 2 });
      expect(onDeleteMock).toHaveBeenCalledWith(userId, ["item-1", "item-2"]);
    });

    it("deletes entities without unbind and without onDelete hook", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "item-no-hook" }]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      dbDeleteMock.mockReturnValue({ where: whereMock });

      const deleteAction = deleteEntityFactory({ table: mockTable });
      const result = await deleteAction("item-no-hook");
      expect(result).toEqual({ deletedCount: 1 });
    });

    it("throws Not Found when standard delete returns empty array", async () => {
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      dbDeleteMock.mockReturnValue({ where: whereMock });

      const deleteAction = deleteEntityFactory({ table: mockTable });

      await expect(deleteAction("missing-id")).rejects.toThrow("Not Found");
    });
  });

  describe("renameEntityFactory", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    it("renames entity with UUID validation and nameSchema", async () => {
      const updatedRow = { id: validUuid, name: "New Name" };
      const returningMock = vi.fn().mockResolvedValue([updatedRow]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      dbUpdateMock.mockReturnValue({ set: setMock });

      const renameAction = renameEntityFactory({
        table: mockTable,
        nameField: "name",
        nameSchema: z.string().min(3),
      });

      const result = await renameAction(validUuid, "New Name");

      expect(result).toEqual(updatedRow);
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Name", updatedAt: expect.any(Date) }),
      );
    });

    it("supports validateId: false and default string name", async () => {
      const updatedRow = { id: "non-uuid-id", customName: "Renamed" };
      const returningMock = vi.fn().mockResolvedValue([updatedRow]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      dbUpdateMock.mockReturnValue({ set: setMock });

      const renameAction = renameEntityFactory({
        table: mockTable,
        nameField: "customName",
        validateId: false,
      });

      const result = await renameAction("non-uuid-id", "Renamed");
      expect(result).toEqual(updatedRow);
    });

    it("throws Not Found when update returns no rows", async () => {
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      dbUpdateMock.mockReturnValue({ set: setMock });

      const renameAction = renameEntityFactory({
        table: mockTable,
        validateId: false,
      });

      await expect(renameAction("id-1", "Name")).rejects.toThrow("Not Found");
    });
  });

  describe("updateEntityFactory", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";
    const schema = z.object({ title: z.string().optional(), count: z.number().optional() });

    it("updates entity filtering undefined fields and setting updatedAt", async () => {
      const updatedRow = { id: validUuid, title: "Updated Title" };
      const returningMock = vi.fn().mockResolvedValue([updatedRow]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      dbUpdateMock.mockReturnValue({ set: setMock });

      const updateAction = updateEntityFactory({
        table: mockTable,
        schema,
      });

      const result = await updateAction(validUuid, { title: "Updated Title", count: undefined });

      expect(result).toEqual(updatedRow);
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Updated Title", updatedAt: expect.any(Date) }),
      );
    });

    it("uses mapValues when provided and handles table without updatedAt", async () => {
      const tableWithoutUpdatedAt = { id: "table.id", userId: "table.userId" };
      const updatedRow = { id: validUuid, customMapped: "val" };
      const returningMock = vi.fn().mockResolvedValue([updatedRow]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      dbUpdateMock.mockReturnValue({ set: setMock });

      const updateAction = updateEntityFactory({
        table: tableWithoutUpdatedAt,
        schema,
        mapValues: (data) => ({ customMapped: data.title }),
      });

      const result = await updateAction(validUuid, { title: "val" });

      expect(result).toEqual(updatedRow);
      expect(setMock).toHaveBeenCalledWith({ customMapped: "val" });
    });

    it("throws Not Found when update returns no rows", async () => {
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      dbUpdateMock.mockReturnValue({ set: setMock });

      const updateAction = updateEntityFactory({
        table: mockTable,
        schema,
      });

      await expect(updateAction(validUuid, { title: "Test" })).rejects.toThrow("Not Found");
    });
  });
});
