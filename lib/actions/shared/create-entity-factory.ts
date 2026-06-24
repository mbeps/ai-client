import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Configuration for creating a Server Action that inserts a new owned row.
 *
 * @template TSchema - Zod inference type for the input schema.
 */
export interface CreateEntityConfig<TSchema> {
  /** Drizzle table object (must have .id and .userId columns). */
  table: any;
  /** Zod schema for validating the input payload. */
  schema: z.ZodType<TSchema>;
  /**
   * Optional transform function that maps validated data to the insert values object.
   * Receives validated data and the authenticated user's ID.
   * Omit to spread `validated` and inject `userId` automatically.
   */
  mapValues?: (validated: TSchema, userId: string) => Record<string, unknown>;
  /**
   * Optional async hook that runs **before** schema validation.
   * Useful for side-effect pre-checks (e.g. verifying a provider is configured).
   */
  beforeValidate?: (data: TSchema, userId: string) => Promise<void>;
  /** Optional label for audit-logging (e.g. "Project"). Suppressed when omitted. */
  auditName?: string;
  /** Optional function that returns extra context for the audit entry. */
  auditData?: (row: any) => Record<string, unknown>;
}

/**
 * Creates a Server Action that inserts a new row into the given table with
 * ownership bound to the authenticated user.
 *
 * The returned function is intended to be re-exported as a named export from a
 * `"use server"` file.  Example:
 *
 * ```ts
 * "use server";
 * export const createProject = createEntityFactory({ table: project, schema: createProjectSchema });
 * ```
 */
export function createEntityFactory<TSchema, TResult>(
  config: CreateEntityConfig<TSchema>,
) {
  return async function create(data: TSchema): Promise<TResult> {
    const session = await requireSession();

    if (config.beforeValidate) {
      await config.beforeValidate(data, session.user.id);
    }

    const validated = config.schema.parse(data);

    const values = config.mapValues
      ? config.mapValues(validated, session.user.id)
      : { ...validated, userId: session.user.id };

    const rows = (await db
      .insert(config.table)
      .values(values)
      .returning()) as TResult[];
    const row = rows[0];

    if (config.auditName) {
      logger.audit(`Create ${config.auditName}`, {
        userId: session.user.id,
        ...(config.auditData?.(row) ?? {}),
      });
    }

    return row;
  };
}
