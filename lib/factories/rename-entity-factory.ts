import { z } from "zod";
import { db } from "@/drizzle/db";
import { requireSession } from "@/lib/auth/require-session";
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
 * Configuration for creating a Server Action that renames an owned row.
 */
export interface RenameEntityConfig {
  /** Drizzle table object (must have .id and .userId columns). */
  table: any;
  /** Column name for the display-name field — defaults to `"name"`. */
  nameField?: string;
  /**
   * When `true` (default), the `id` parameter is validated as a UUID before
   * being used in the query. Set to `false` if your table uses a non-UUID
   * primary key.
   */
  validateId?: boolean;
  /** Optional schema for validating the `name` value. Falls back to a plain string when omitted. */
  nameSchema?: z.ZodType<string>;
}

/**
 * Creates a Server Action that renames an owned row after verifying ownership.
 * Wraps the action in defineAction and returns a Result.
 *
 * @param config - Target config
 * @returns The resolved Result
 * @author Maruf Bepary
 */
export function renameEntityFactory<TResult>(config: RenameEntityConfig) {
  const nameField = config.nameField ?? "name";
  const validateId = config.validateId !== false; // default true

  return defineAction(
    async (id: string, name: string): Promise<Result<TResult, CommonError>> => {
      const session = await requireSession();

      let resolvedId = id;
      if (validateId) {
        const idParsed = z.string().uuid().safeParse(id);
        if (!idParsed.success) {
          return fail({
            code: ERROR_CODE.INVALID_INPUT,
            message: "Invalid entity ID format",
          });
        }
        resolvedId = idParsed.data;
      }

      let resolvedName = name;
      if (config.nameSchema) {
        const nameParsed = config.nameSchema.safeParse(name);
        if (!nameParsed.success) {
          const issues = nameParsed.error.issues.map((i) =>
            i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message,
          );
          return fail({
            code: ERROR_CODE.INVALID_INPUT,
            message: nameParsed.error.issues[0]?.message ?? "Invalid name",
            issues,
          });
        }
        resolvedName = nameParsed.data;
      }

      const [updated] = await db
        .update(config.table)
        .set({ [nameField]: resolvedName, updatedAt: new Date() })
        .where(whereOwner(config.table, resolvedId, session.user.id))
        .returning();

      if (!updated) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Not Found",
        });
      }

      log.info("Renamed entity (id: {id})", {
        id: resolvedId,
        userId: session.user.id,
      });

      return ok(updated as TResult);
    },
  );
}
