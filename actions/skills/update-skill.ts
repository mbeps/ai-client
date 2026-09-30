"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { updateSkillForUser } from "@/lib/skills/skill-service";
import { updateSkillSchema } from "@/schemas/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Updates an existing Agent Skill for the authenticated user.
 * Validates slug uniqueness if name is modified.
 *
 * @decision Delegates to the skill service so the ownership and uniqueness
 * rules have one owner, shared with the AI tools.
 * @author Maruf Bepary
 */
export async function updateSkill(
  id: string,
  data: z.infer<typeof updateSkillSchema>,
): Promise<SkillRow> {
  const session = await requireSession();
  const validatedId = z.string().uuid().parse(id);
  const validatedData = updateSkillSchema.parse(data);

  const row = await updateSkillForUser(
    session.user.id,
    validatedId,
    validatedData,
  );

  if (!row) throw new Error("Not Found");

  return row;
}
