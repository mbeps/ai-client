import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

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
   * being used in the query.  Set to `false` if your table uses a non-UUID
   * primary key.
   */
  validateId?: boolean;
  /** Optional schema for validating the `name` value.  Falls back to a plain string when omitted. */
  nameSchema?: z.ZodType<string>;
}

/**
 * Creates a Server Action that renames an owned row after verifying ownership.
 *
 * The returned function is intended to be re-exported as a named export from a
 * `"use server"` file.  Example:
 *
 * ```ts
 * "use server";
 * export const renameProject = renameEntityFactory({ table: project });
 * ```
 */
export function renameEntityFactory<TResult>(config: RenameEntityConfig) {
  const nameField = config.nameField ?? "name";
  const validateId = config.validateId !== false; // default true

  return async function rename(id: string, name: string): Promise<TResult> {
    const session = await requireSession();

    const resolvedId = validateId ? z.string().uuid().parse(id) : id;
    const resolvedName = config.nameSchema
      ? config.nameSchema.parse(name)
      : name;

    const [updated] = await db
      .update(config.table)
      .set({ [nameField]: resolvedName, updatedAt: new Date() })
      .where(
        and(
          eq(config.table.id, resolvedId),
          eq(config.table.userId, session.user.id),
        ),
      )
      .returning();

    if (!updated) throw new Error("Not Found");

    return updated as TResult;
  };
}
