"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schemas/skill-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Toggles the enabled status of an Agent Skill.
 *
 * @param id - UUID of the skill to toggle
 * @param enabled - Target boolean enabled state
 * @returns Result wrapping updated skill database record
 * @author Maruf Bepary
 */
export const toggleSkillEnabled = defineAction(
  async (
    id: string,
    enabled: boolean,
  ): Promise<Result<SkillRow, CommonError>> => {
    const session = await requireSession();
    const validatedId = z.string().uuid().safeParse(id);
    if (!validatedId.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid skill ID",
      });
    }

    const [row] = await db
      .update(skill)
      .set({
        enabled,
        updatedAt: new Date(),
      })
      .where(
        and(eq(skill.id, validatedId.data), eq(skill.userId, session.user.id)),
      )
      .returning();

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(row as SkillRow);
  },
);
