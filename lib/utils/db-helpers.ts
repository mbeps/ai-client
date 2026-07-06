import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";

/**
 * Common ownership check helper for Drizzle queries.
 * Returns a filter expression that matches the item ID and the user's ID.
 *
 * @param table - The Drizzle table object (must have .id and .userId columns)
 * @param idOrIds - The ID or IDs of the resources being accessed
 * @param userId - The ID of the authenticated user
 * @returns An 'and' expression for ownership validation
 */
function whereOwner(table: any, idOrIds: string | string[], userId: string) {
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  return and(inArray(table.id, ids), eq(table.userId, userId));
}

/**
 * Standard ownership verification after a database read.
 * Throws consistent errors for non-existent or unauthorized access.
 *
 * @param row - The retrieved database record (or undefined/null)
 * @param userId - The ID of the authenticated user (optional - if row has userId, it will be checked)
 * @returns The row if valid
 * @throws Error "Not Found" if row is missing or user doesn't own it
 */
function verifyOwnership<T extends { userId: string }>(
  row: T | undefined | null,
  userId?: string,
): T {
  if (!row) {
    throw new Error("Not Found");
  }

  if (userId && row.userId !== userId) {
    throw new Error("Not Found");
  }

  return row;
}

/**
 * Fetches an owned resource and verifies ownership in a single step.
 *
 * @param table - The Drizzle table object
 * @param id - The ID of the resource
 * @param userId - The ID of the authenticated user
 * @returns The retrieved resource
 */
async function getOwnedResource<T extends { userId: string }>(
  table: any,
  id: string,
  userId: string,
): Promise<T> {
  const [row] = await db
    .select()
    .from(table)
    .where(whereOwner(table, id, userId));
  return verifyOwnership(row as T | undefined | null, userId);
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

  return await db.transaction(async (tx) => {
    // If the unbind table has a userId field, we should filter by it too.
    const unbindWhere = unbindOptions.table.userId
      ? and(
          inArray(unbindOptions.field, ids),
          eq(unbindOptions.table.userId, userId),
        )
      : inArray(unbindOptions.field, ids);

    await tx
      .update(unbindOptions.table)
      .set({ [unbindOptions.field]: null })
      .where(unbindWhere);

    return await tx
      .delete(resourceTable)
      .where(whereOwner(resourceTable, ids, userId))
      .returning({ id: resourceTable.id });
  });
}
