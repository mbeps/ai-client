"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { getSkillForUser } from "@/lib/skills/skill-crud-service";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Fetches a single Agent Skill by ID for the authenticated user.
 *
 * @param id - UUID of the skill to fetch
 * @returns Result wrapping skill database record
 * @author Maruf Bepary
 */
export const getSkill = defineAction(
  async (id: string): Promise<Result<SkillRow, CommonError>> => {
    const session = await requireSession();
    const validatedId = z.string().uuid().safeParse(id);
    if (!validatedId.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid skill ID",
      });
    }

    const row = await getSkillForUser(session.user.id, validatedId.data);
    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(row);
  },
);
