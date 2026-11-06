"use server";

import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { deleteSkillForUser } from "@/lib/skills/skill-crud-service";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Deletes one or more Agent Skills, verifying ownership by the authenticated user.
 *
 * @param idOrIds - Single UUID or array of skill UUIDs to delete
 * @returns Result wrapping object with the number of skills deleted
 * @author Maruf Bepary
 */
export const deleteSkill = defineAction(
  async (
    idOrIds: string | string[],
  ): Promise<Result<{ deletedCount: number }, CommonError>> => {
    const session = await requireSession();
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    if (ids.length === 0) {
      return ok({ deletedCount: 0 });
    }

    const counts = await Promise.all(
      ids.map((id) => deleteSkillForUser(session.user.id, id)),
    );
    const deletedCount = counts.reduce(
      (sum, result) => sum + result.deletedCount,
      0,
    );

    if (deletedCount === 0) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok({ deletedCount });
  },
);
