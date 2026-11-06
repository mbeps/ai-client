"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { updateSkillForUser } from "@/lib/skills/skill-crud-service";
import { updateSkillSchema } from "@/schemas/skill/skill";
import { SkillBundleBudgetError } from "@/schemas/skill/skill-file";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Updates an existing Agent Skill for the authenticated user.
 * Validates slug uniqueness if name is modified.
 *
 * @param id - UUID of the skill to update
 * @param data - Partial skill update payload
 * @returns Result wrapping updated skill database record
 * @author Maruf Bepary
 */
export const updateSkill = defineAction(
  async (
    id: string,
    data: z.infer<typeof updateSkillSchema>,
  ): Promise<Result<SkillRow, CommonError>> => {
    const session = await requireSession();
    const validatedId = z.string().uuid().safeParse(id);
    if (!validatedId.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid skill ID",
      });
    }

    const validatedData = updateSkillSchema.safeParse(data);
    if (!validatedData.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: validatedData.error.issues[0].message,
      });
    }

    try {
      const row = await updateSkillForUser(
        session.user.id,
        validatedId.data,
        validatedData.data,
      );

      if (!row) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Not Found",
        });
      }

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
