"use server";

import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import { listSkillsForUser } from "@/lib/skills/skill-crud-service";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Fetches all saved Agent Skills for the authenticated user, ordered by most recently updated first.
 *
 * @returns Result wrapping array of SkillRow objects
 * @author Maruf Bepary
 */
export const listSkills = defineAction(
  async (): Promise<Result<SkillRow[], CommonError>> => {
    const session = await requireSession();

    const rows = await listSkillsForUser(session.user.id);
    return ok(rows);
  },
);
