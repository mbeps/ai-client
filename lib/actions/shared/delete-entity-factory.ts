import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { and, eq } from "drizzle-orm";
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
  return async function remove(id: string): Promise<void> {
    const session = await requireSession();

    if (config.unbind) {
      await deleteResourceWithUnbind(config.table, id, session.user.id, {
        table: config.unbind.table,
        field: config.unbind.field,
      });
      return;
    }

    const [row] = await db
      .delete(config.table)
      .where(
        and(eq(config.table.id, id), eq(config.table.userId, session.user.id)),
      )
      .returning({ id: config.table.id });

    if (!row) throw new Error("Not Found");
  };
}
