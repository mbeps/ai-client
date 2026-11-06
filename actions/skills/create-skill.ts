"use server";

import type { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { createSkillForUser } from "@/lib/skills/skill-crud-service";
import { createSkillSchema } from "@/schemas/skill/skill";
import { SkillBundleBudgetError } from "@/schemas/skill/skill-file";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Creates a new Agent Skill for the authenticated user.
 * Enforces slug uniqueness per user.
 *
 * @param data - Skill creation payload adhering to createSkillSchema
 * @returns Result wrapping created skill database record
 * @author Maruf Bepary
 */
export const createSkill = defineAction(
  async (
    data: z.infer<typeof createSkillSchema>,
  ): Promise<Result<SkillRow, CommonError>> => {
    const session = await requireSession();
    const validated = createSkillSchema.safeParse(data);
    if (!validated.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: validated.error.issues[0].message,
      });
    }

    try {
      const row = await createSkillForUser(session.user.id, validated.data);
      return ok(row);
    } catch (err) {
      if (err instanceof AppException) {
        return fail(err.error);
      }
      if (err instanceof SkillBundleBudgetError) {
        return fail({
          code: ERROR_CODE.INVALID_INPUT,
          message: err.message,
        });
      }
      throw err;
    }
  },
);
