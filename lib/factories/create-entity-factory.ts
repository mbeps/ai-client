import type { z } from "zod";
import { db } from "@/drizzle/db";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "factory"]);

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
 * Creates a Server Action that inserts a new row into the given table with ownership bound to the authenticated user.
 * Wraps the handler in defineAction and returns a Result.
 *
 * @param config - Target config
 * @returns Server action returning a Result
 * @author Maruf Bepary
 */
export function createEntityFactory<TSchema, TResult>(
  config: CreateEntityConfig<TSchema>,
) {
  return defineAction(
    async (data: TSchema): Promise<Result<TResult, CommonError>> => {
      const session = await requireSession();

      if (config.beforeValidate) {
        await config.beforeValidate(data, session.user.id);
      }

      const parsed = config.schema.safeParse(data);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) =>
          i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message,
        );
        return fail({
          code: ERROR_CODE.INVALID_INPUT,
          message: parsed.error.issues[0]?.message ?? "Invalid input",
          issues,
        });
      }

      const validated = parsed.data;
      const values = config.mapValues
        ? config.mapValues(validated, session.user.id)
        : { ...validated, userId: session.user.id };

      const rows = (await db
        .insert(config.table)
        .values(values)
        .returning()) as TResult[];
      const row = rows[0];

      if (config.auditName) {
        log.info("Created {entity} (id: {id})", {
          entity: config.auditName,
          id: (row as any)?.id,
          userId: session.user.id,
          ...(config.auditData?.(row) ?? {}),
        });
      }

      return ok(row);
    },
  );
}
