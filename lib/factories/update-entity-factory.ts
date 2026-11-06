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
 * Represents update entity config.
 *
 * @author Maruf Bepary
 */
export interface UpdateEntityConfig<TSchema, _TResult> {
  /** Drizzle table object (must have .id and .userId columns). */
  table: any;
  /** Zod schema for validating the input payload (id is handled internally). */
  schema: z.ZodType<TSchema>;
  /**
   * Optional transform function to map validated data to DB values.
   * If omitted, a generic partial mapping is used which excludes undefined.
   */
  mapValues?: (validated: TSchema) => Record<string, unknown>;
}

/**
 * A factory function to create a standardized update action for any entity.
 * It handles session retrieval, input validation, ownership check, and database update,
 * returning a Result wrapped by defineAction.
 *
 * @param config - Configuration object for the update action.
 * @returns An async function that performs the update and returns a Result.
 * @author Maruf Bepary
 */
export function updateEntityFactory<TSchema, TResult>(
  config: UpdateEntityConfig<TSchema, TResult>,
) {
  const { table, schema, mapValues } = config;

  return defineAction(
    async (
      id: string,
      data: TSchema,
    ): Promise<Result<TResult, CommonError>> => {
      const session = await requireSession();

      // Validate inputs
      const idParsed = z.string().uuid().safeParse(id);
      if (!idParsed.success) {
        return fail({
          code: ERROR_CODE.INVALID_INPUT,
          message: "Invalid entity ID format",
        });
      }
      const validatedId = idParsed.data;

      const dataParsed = schema.safeParse(data);
      if (!dataParsed.success) {
        const issues = dataParsed.error.issues.map((i) =>
          i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message,
        );
        return fail({
          code: ERROR_CODE.INVALID_INPUT,
          message: dataParsed.error.issues[0]?.message ?? "Invalid input",
          issues,
        });
      }
      const validatedData = dataParsed.data;

      // Prepare update data
      const updateValues: Record<string, unknown> = mapValues
        ? mapValues(validatedData)
        : Object.fromEntries(
            Object.entries(validatedData as any).filter(
              ([_, v]) => v !== undefined,
            ),
          );

      // Ensure updatedAt is set if the table has it
      if ("updatedAt" in table) {
        updateValues.updatedAt = new Date();
      }

      const [row] = await db
        .update(table)
        .set(updateValues)
        .where(whereOwner(table, validatedId, session.user.id))
        .returning();

      if (!row) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Not Found",
        });
      }

      log.info("Updated entity (id: {id})", {
        id: validatedId,
        userId: session.user.id,
      });

      return ok(row as TResult);
    },
  );
}
