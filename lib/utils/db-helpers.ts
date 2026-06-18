import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";

/**
 * Common ownership check helper for Drizzle queries.
 * Returns a filter expression that matches the item ID and the user's ID.
 *
 * @param table - The Drizzle table object (must have .id and .userId columns)
 * @param id - The ID of the resource being accessed
 * @param userId - The ID of the authenticated user
 * @returns An 'and' expression for ownership validation
 */
function whereOwner(table: any, id: string, userId: string) {
  return and(eq(table.id, id), eq(table.userId, userId));
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
 * Deletes a resource after first unbinding it from another record (e.g., clearing a project_id from chats).
 *
 * @param resourceTable - The table containing the resource to delete
 * @param id - The ID of the resource
 * @param userId - The ID of the user
 * @param unbindOptions - Configuration for the unbind step (table and field to clear)
 */
export async function deleteResourceWithUnbind(
  resourceTable: any,
  id: string,
  userId: string,
  unbindOptions: { table: any; field: any },
) {
  return await db.transaction(async (tx) => {
    // If the unbind table has a userId field, we should filter by it too.
    const unbindWhere = unbindOptions.table.userId
      ? and(eq(unbindOptions.field, id), eq(unbindOptions.table.userId, userId))
      : eq(unbindOptions.field, id);

    await tx
      .update(unbindOptions.table)
      .set({ [unbindOptions.field]: null })
      .where(unbindWhere);

    return await tx
      .delete(resourceTable)
      .where(whereOwner(resourceTable, id, userId));
  });
}
