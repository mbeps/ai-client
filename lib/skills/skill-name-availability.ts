import { and, eq, ne } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schemas/skill-schema";
import { ERROR_CODE } from "@/lib/error/error-code";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Checks if the skill name is available for the given user.
 *
 * @param userId - User identifier
 * @param name - Target name
 * @param excludeId - Skill id to ignore, used when renaming an existing skill
 * @returns Result wrapping void if available or CommonError if conflict
 * @author Maruf Bepary
 */
export async function assertNameAvailable(
  userId: string,
  name: string,
  excludeId?: string,
): Promise<Result<void, CommonError>> {
  const existing = await db
    .select({ id: skill.id })
    .from(skill)
    .where(
      and(
        eq(skill.userId, userId),
        eq(skill.name, name),
        ...(excludeId ? [ne(skill.id, excludeId)] : []),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return fail({
      code: ERROR_CODE.CONFLICT,
      message: `A skill with name "${name}" already exists.`,
    });
  }

  return ok(undefined);
}
