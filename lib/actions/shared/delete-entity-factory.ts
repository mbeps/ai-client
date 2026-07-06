import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { and, eq, inArray } from "drizzle-orm";
import { deleteResourceWithUnbind } from "@/lib/utils/db-helpers";

/**
 * Configuration for creating a Server Action that deletes an owned row.
 */
export interface DeleteEntityConfig {
  /** Drizzle table object (must have .id and .userId columns). */
  table: any;
  /**
   * When provided, the related records on `unbind.table` will have
   * `unbind.field` set to `null` **before** the row is deleted, all inside a
   * single database transaction.
   */
  unbind?: {
    /** The related table to unbind from (e.g. `chat`). */
    table: any;
    /** The foreign-key column on the related table to clear (e.g. `chat.projectId`). */
    field: any;
  };
  /**
   * Optional hook to run after the deletion is successful.
   * Receives the user ID and the IDs of the deleted entities.
   */
  onDelete?: (userId: string, ids: string[]) => Promise<void>;
}

/**
 * Creates a Server Action that deletes an owned row after verifying ownership.
 *
 * The returned function is intended to be re-exported as a named export from a
 * `"use server"` file.  Example:
 *
 * ```ts
 * "use server";
 * export const deleteProject = deleteEntityFactory({ table: project, unbind: { table: chat, field: chat.projectId } });
 * ```
 */
export function deleteEntityFactory(config: DeleteEntityConfig) {
  return async function remove(
    idOrIds: string | string[],
  ): Promise<{ deletedCount: number }> {
    const session = await requireSession();
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    if (ids.length === 0) {
      return { deletedCount: 0 };
    }

    if (config.unbind) {
      const results = await deleteResourceWithUnbind(
        config.table,
        ids,
        session.user.id,
        {
          table: config.unbind.table,
          field: config.unbind.field,
        },
      );

      const deletedCount = results.length;
      if (deletedCount === 0) throw new Error("Not Found");

      if (config.onDelete) {
        await config.onDelete(session.user.id, ids);
      }

      return { deletedCount };
    }

    const results = await db
      .delete(config.table)
      .where(
        and(inArray(config.table.id, ids), eq(config.table.userId, session.user.id)),
      )
      .returning({ id: config.table.id });

    if (results.length === 0) throw new Error("Not Found");

    if (config.onDelete) {
      await config.onDelete(
        session.user.id,
        results.map((r) => r.id),
      );
    }

    return { deletedCount: results.length };
  };
}
