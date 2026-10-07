import { and, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { whereOwner } from "./where-owner";

/**
 * Resolves the schema property key name for a given table and column/field.
 * Handles both string property names and Drizzle Column instances (e.g., PgColumn).
 *
 * @param table - The table containing the column
 * @param field - The field property name or Drizzle column object
 * @returns The property key name to pass to Drizzle `.set()`
 */
export function resolveFieldKey(table: any, field: any): string {
  if (typeof field === "string") {
    return field;
  }

  if (table && typeof table === "object") {
    for (const [key, val] of Object.entries(table)) {
      if (
        val === field ||
        (val &&
          typeof val === "object" &&
          (val as any).name &&
          (val as any).name === (field as any)?.name)
      ) {
        return key;
      }
    }

    try {
      const cols = getTableColumns(table);
      for (const [key, val] of Object.entries(cols)) {
        if (val === field || (val as any)?.name === (field as any)?.name) {
          return key;
        }
      }
    } catch {
      // Table may not be a Drizzle table instance (e.g. in unit tests)
    }
  }

  if (field && typeof field === "object" && field.table) {
    for (const [key, val] of Object.entries(field.table)) {
      if (
        val === field ||
        (val &&
          typeof val === "object" &&
          (val as any).name &&
          (val as any).name === (field as any)?.name)
      ) {
        return key;
      }
    }

    try {
      const cols = getTableColumns(field.table);
      for (const [key, val] of Object.entries(cols)) {
        if (val === field || (val as any)?.name === (field as any)?.name) {
          return key;
        }
      }
    } catch {
      // Ignore
    }
  }

  if (field && typeof field === "object" && "name" in field) {
    return field.name;
  }

  return String(field);
}

/**
 * Deletes one or more resources after first unbinding them from another record (e.g., clearing a project_id from chats).
 *
 * @param resourceTable - The table containing the resource to delete
 * @param idOrIds - The ID or IDs of the resources
 * @param userId - The ID of the user
 * @param unbindOptions - Configuration for the unbind step (table and field to clear)
 */
export async function deleteResourceWithUnbind(
  resourceTable: any,
  idOrIds: string | string[],
  userId: string,
  unbindOptions: { table: any; field: any },
) {
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  const fieldKey = resolveFieldKey(unbindOptions.table, unbindOptions.field);
  const unbindColumn =
    typeof unbindOptions.field === "string"
      ? (unbindOptions.table?.[unbindOptions.field] ?? unbindOptions.field)
      : unbindOptions.field;

  return await db.transaction(async (tx) => {
    // If the unbind table has a userId field, we should filter by it too.
    const unbindWhere = unbindOptions.table.userId
      ? and(inArray(unbindColumn, ids), eq(unbindOptions.table.userId, userId))
      : inArray(unbindColumn, ids);

    await tx
      .update(unbindOptions.table)
      .set({ [fieldKey]: null })
      .where(unbindWhere);

    return await tx
      .delete(resourceTable)
      .where(whereOwner(resourceTable, ids, userId))
      .returning({ id: resourceTable.id });
  });
}
