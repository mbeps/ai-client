import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createEntityFactory } from "@/lib/factories/create-entity-factory";
import { deleteEntityFactory } from "@/lib/factories/delete-entity-factory";
import { renameEntityFactory } from "@/lib/factories/rename-entity-factory";
import { updateEntityFactory } from "@/lib/factories/update-entity-factory";
import { ERROR_CODE } from "@/lib/error/error-code";

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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(insertedRow);
      }
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(insertedRow);
      }
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

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(insertedRow);
      }
      expect(beforeValidateMock).toHaveBeenCalledWith({ title: "Mapped" }, userId);
      expect(valuesMock).toHaveBeenCalledWith({ title: "Mapped", customUser: userId });
    });

    it("returns INVALID_INPUT when schema validation fails", async () => {
      const createAction = createEntityFactory({
        table: mockTable,
        schema,
      });

      const result = await createAction({ title: 123 as any });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      }

      // Test with custom schema error having non-empty path and issues
      const customSchemaWithPath = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: {
            issues: [{ path: ["field", "nested"], message: "Nested error" }],
          },
        }),
      } as any;
      const customActionWithPath = createEntityFactory({
        table: mockTable,
        schema: customSchemaWithPath,
      });
      const resCustomWithPath = await customActionWithPath({} as any);
      expect(resCustomWithPath.ok).toBe(false);

      // Test with custom schema error having empty path and missing message fallback
      const customSchema = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: {
            issues: [],
          },
        }),
      } as any;
      const customAction = createEntityFactory({
        table: mockTable,
        schema: customSchema,
      });
      const resCustom = await customAction({} as any);
      expect(resCustom.ok).toBe(false);
      if (!resCustom.ok) {
        expect(resCustom.error.code).toBe(ERROR_CODE.INVALID_INPUT);
        expect(resCustom.error.message).toBe("Invalid input");
      }

      // Test with empty path issue
      const customSchemaEmptyPath = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: {
            issues: [{ path: [], message: "Root error" }],
          },
        }),
      } as any;
      const customActionEmptyPath = createEntityFactory({
        table: mockTable,
        schema: customSchemaEmptyPath,
      });
      const resCustomEmptyPath = await customActionEmptyPath({} as any);
      expect(resCustomEmptyPath.ok).toBe(false);
      if (!resCustomEmptyPath.ok) {
        expect(resCustomEmptyPath.error.issues).toEqual(["Root error"]);
      }
    });
  });

  describe("deleteEntityFactory", () => {
    it("returns 0 deleted count immediately for empty ids array", async () => {
      const deleteAction = deleteEntityFactory({ table: mockTable });
      const result = await deleteAction([]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ deletedCount: 0 });
      }
      expect(dbDeleteMock).not.toHaveBeenCalled();
    });

    it("deletes single entity with unbind and onDelete hook", async () => {
      const onDeleteMock = vi.fn().mockResolvedValue(undefined);
      deleteResourceWithUnbindMock.mockResolvedValue([{ id: "item-1" }]);

      const deleteAction = deleteEntityFactory({
        table: mockTable,
        unbind: { table: "unbind.table", field: "unbind.field" },
        onDelete: onDeleteMock,
      });

      const result = await deleteAction("item-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ deletedCount: 1 });
      }
      expect(deleteResourceWithUnbindMock).toHaveBeenCalledWith(
        mockTable,
        ["item-1"],
        userId,
        { table: "unbind.table", field: "unbind.field" },
      );
      expect(onDeleteMock).toHaveBeenCalledWith(userId, ["item-1"]);
    });

    it("deletes with unbind when onDelete is not configured", async () => {
      deleteResourceWithUnbindMock.mockResolvedValue([{ id: "item-1" }]);

      const deleteAction = deleteEntityFactory({
        table: mockTable,
        unbind: { table: "unbind.table", field: "unbind.field" },
      });

      const result = await deleteAction("item-1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ deletedCount: 1 });
      }
    });

    it("returns NOT_FOUND when unbind deletion yields 0 rows", async () => {
      deleteResourceWithUnbindMock.mockResolvedValue([]);

      const deleteAction = deleteEntityFactory({
        table: mockTable,
        unbind: { table: "unbind.table", field: "unbind.field" },
      });

      const result = await deleteAction("item-1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      }
    });

    it("deletes entities without unbind and calls onDelete hook", async () => {
      const onDeleteMock = vi.fn().mockResolvedValue(undefined);
      const returningMock = vi.fn().mockResolvedValue([{ id: "item-1" }, { id: "item-2" }]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      dbDeleteMock.mockReturnValue({ where: whereMock });

      const deleteAction = deleteEntityFactory({
        table: mockTable,
        onDelete: onDeleteMock,
      });

      const result = await deleteAction(["item-1", "item-2"]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ deletedCount: 2 });
      }
      expect(dbDeleteMock).toHaveBeenCalledWith(mockTable);
      expect(onDeleteMock).toHaveBeenCalledWith(userId, ["item-1", "item-2"]);
    });

    it("deletes entities without unbind and without onDelete hook", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "item-1" }]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      dbDeleteMock.mockReturnValue({ where: whereMock });

      const deleteAction = deleteEntityFactory({ table: mockTable });
      const result = await deleteAction("item-1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ deletedCount: 1 });
      }
    });

    it("returns NOT_FOUND when standard delete returns empty array", async () => {
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      dbDeleteMock.mockReturnValue({ where: whereMock });

      const deleteAction = deleteEntityFactory({ table: mockTable });
      const result = await deleteAction("item-1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      }
    });
  });

  describe("renameEntityFactory", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    it("renames entity with UUID validation and nameSchema", async () => {
      const updatedRow = { id: validUuid, title: "Renamed" };
      const returningMock = vi.fn().mockResolvedValue([updatedRow]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      dbUpdateMock.mockReturnValue({ set: setMock });

      const renameAction = renameEntityFactory({
        table: mockTable,
        nameField: "title",
        nameSchema: z.string().min(3),
      });

      const result = await renameAction(validUuid, "Renamed");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(updatedRow);
      }
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Renamed", updatedAt: expect.any(Date) }),
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(updatedRow);
      }
    });

    it("returns NOT_FOUND when update returns no rows", async () => {
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      dbUpdateMock.mockReturnValue({ set: setMock });

      const renameAction = renameEntityFactory({
        table: mockTable,
        validateId: false,
      });

      const result = await renameAction("id-1", "Name");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      }
    });

    it("returns INVALID_INPUT when validation fails", async () => {
      const renameAction = renameEntityFactory({
        table: mockTable,
        nameSchema: z.string().min(5),
      });

      const invalidUuidResult = await renameAction("not-a-uuid", "ValidName");
      expect(invalidUuidResult.ok).toBe(false);
      if (!invalidUuidResult.ok) {
        expect(invalidUuidResult.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      }

      const invalidNameResult = await renameAction(validUuid, "a");
      expect(invalidNameResult.ok).toBe(false);
      if (!invalidNameResult.ok) {
        expect(invalidNameResult.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      }

      // Test with custom nameSchema error having non-empty path
      const customNameSchemaWithPath = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: {
            issues: [{ path: ["name"], message: "Name issue" }],
          },
        }),
      } as any;
      const customRenameWithPath = renameEntityFactory({
        table: mockTable,
        nameSchema: customNameSchemaWithPath,
      });
      const resRenameWithPath = await customRenameWithPath(validUuid, "test");
      expect(resRenameWithPath.ok).toBe(false);

      // Test with custom nameSchema error having empty path and missing message fallback
      const customNameSchema = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: {
            issues: [],
          },
        }),
      } as any;
      const customRenameAction = renameEntityFactory({
        table: mockTable,
        nameSchema: customNameSchema,
      });
      const resCustom = await customRenameAction(validUuid, "test");
      expect(resCustom.ok).toBe(false);
      if (!resCustom.ok) {
        expect(resCustom.error.code).toBe(ERROR_CODE.INVALID_INPUT);
        expect(resCustom.error.message).toBe("Invalid name");
      }

      // Test with empty path issue
      const customNameEmptyPath = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: {
            issues: [{ path: [], message: "Name empty path" }],
          },
        }),
      } as any;
      const customRenameEmptyPath = renameEntityFactory({
        table: mockTable,
        nameSchema: customNameEmptyPath,
      });
      const resCustomRenameEmptyPath = await customRenameEmptyPath(validUuid, "test");
      expect(resCustomRenameEmptyPath.ok).toBe(false);
      if (!resCustomRenameEmptyPath.ok) {
        expect(resCustomRenameEmptyPath.error.issues).toEqual(["Name empty path"]);
      }
    });
  });

  describe("updateEntityFactory", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";
    const schema = z.object({ title: z.string().optional(), description: z.string().optional() });

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

      const result = await updateAction(validUuid, { title: "Updated Title" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(updatedRow);
      }
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Updated Title", updatedAt: expect.any(Date) }),
      );
    });

    it("uses mapValues when provided and handles table without updatedAt", async () => {
      const updatedRow = { id: validUuid, customMapped: "val" };
      const returningMock = vi.fn().mockResolvedValue([updatedRow]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      dbUpdateMock.mockReturnValue({ set: setMock });

      const updateAction = updateEntityFactory({
        table: { id: "table.id", userId: "table.userId" },
        schema,
        mapValues: (data) => ({ customMapped: data.title }),
      });

      const result = await updateAction(validUuid, { title: "val" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(updatedRow);
      }
      expect(setMock).toHaveBeenCalledWith({ customMapped: "val" });
    });

    it("returns NOT_FOUND when update returns no rows", async () => {
      const returningMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      dbUpdateMock.mockReturnValue({ set: setMock });

      const updateAction = updateEntityFactory({
        table: mockTable,
        schema,
      });

      const result = await updateAction(validUuid, { title: "Test" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ERROR_CODE.NOT_FOUND);
      }
    });

    it("returns INVALID_INPUT when ID or payload validation fails", async () => {
      const updateAction = updateEntityFactory({
        table: mockTable,
        schema,
      });

      const resBadId = await updateAction("not-a-uuid", { title: "Test" });
      expect(resBadId.ok).toBe(false);
      if (!resBadId.ok) {
        expect(resBadId.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      }

      const resBadPayload = await updateAction(validUuid, { title: 123 as any });
      expect(resBadPayload.ok).toBe(false);
      if (!resBadPayload.ok) {
        expect(resBadPayload.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      }

      // Test with custom schema error having non-empty path
      const customUpdateSchemaWithPath = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: {
            issues: [{ path: ["data", "field"], message: "Field issue" }],
          },
        }),
      } as any;
      const customUpdateWithPath = updateEntityFactory({
        table: mockTable,
        schema: customUpdateSchemaWithPath,
      });
      const resUpdateWithPath = await customUpdateWithPath(validUuid, {} as any);
      expect(resUpdateWithPath.ok).toBe(false);

      // Test with custom schema error having empty path and missing message fallback
      const customUpdateSchema = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: {
            issues: [],
          },
        }),
      } as any;
      const customUpdateAction = updateEntityFactory({
        table: mockTable,
        schema: customUpdateSchema,
      });
      const resCustom = await customUpdateAction(validUuid, {} as any);
      expect(resCustom.ok).toBe(false);
      if (!resCustom.ok) {
        expect(resCustom.error.code).toBe(ERROR_CODE.INVALID_INPUT);
        expect(resCustom.error.message).toBe("Invalid input");
      }

      // Test with empty path issue
      const customUpdateEmptyPath = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: {
            issues: [{ path: [], message: "Update empty path" }],
          },
        }),
      } as any;
      const customUpdateActionEmptyPath = updateEntityFactory({
        table: mockTable,
        schema: customUpdateEmptyPath,
      });
      const resCustomUpdateEmptyPath = await customUpdateActionEmptyPath(validUuid, {} as any);
      expect(resCustomUpdateEmptyPath.ok).toBe(false);
      if (!resCustomUpdateEmptyPath.ok) {
        expect(resCustomUpdateEmptyPath.error.issues).toEqual(["Update empty path"]);
      }
    });
  });
});
