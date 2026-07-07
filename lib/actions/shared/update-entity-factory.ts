import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { whereOwner } from "@/lib/db/where-owner";
import { z } from "zod";

export interface UpdateEntityConfig<TSchema, TResult> {
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
 * It handles session retrieval, input validation, ownership check, and database update.
 *
 * @param config - Configuration object for the update action.
 * @returns An async function that performs the update and returns the updated record.
 */
export function updateEntityFactory<TSchema, TResult>(
  config: UpdateEntityConfig<TSchema, TResult>,
) {
  const { table, schema, mapValues } = config;

  return async (id: string, data: TSchema): Promise<TResult> => {
    const session = await requireSession();

    // Validate inputs
    const validatedId = z.string().uuid().parse(id);
    const validatedData = schema.parse(data);

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
      throw new Error("Not Found");
    }

    return row as TResult;
  };
}
