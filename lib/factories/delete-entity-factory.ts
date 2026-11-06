import { db } from "@/drizzle/db";
import { requireSession } from "@/lib/auth/require-session";
import { deleteResourceWithUnbind } from "@/lib/db/delete-resource-with-unbind";
import { whereOwner } from "@/lib/db/where-owner";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "factory"]);

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
 * Wraps the action in defineAction and returns a Result.
 *
 * @param config - Target config
 * @returns The resolved Result
 * @author Maruf Bepary
 */
export function deleteEntityFactory(config: DeleteEntityConfig) {
  return defineAction(
    async (
      idOrIds: string | string[],
    ): Promise<Result<{ deletedCount: number }, CommonError>> => {
      const session = await requireSession();
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

      if (ids.length === 0) {
        return ok({ deletedCount: 0 });
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
        if (deletedCount === 0) {
          return fail({
            code: ERROR_CODE.NOT_FOUND,
            message: "Not Found",
          });
        }

        if (config.onDelete) {
          await config.onDelete(session.user.id, ids);
        }

        log.info("Deleted entities (count: {deletedCount})", {
          deletedCount,
          userId: session.user.id,
        });

        return ok({ deletedCount });
      }

      const results = await db
        .delete(config.table)
        .where(whereOwner(config.table, ids, session.user.id))
        .returning({ id: config.table.id });

      if (results.length === 0) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Not Found",
        });
      }

      if (config.onDelete) {
        await config.onDelete(
          session.user.id,
          results.map((r) => r.id),
        );
      }

      log.info("Deleted entities (count: {deletedCount})", {
        deletedCount: results.length,
        userId: session.user.id,
      });

      return ok({ deletedCount: results.length });
    },
  );
}
