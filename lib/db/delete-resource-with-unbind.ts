import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { whereOwner } from "./where-owner";

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
