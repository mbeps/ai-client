"use server";

import type { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { createSkillForUser } from "@/lib/skills/skill-crud-service";
import { createSkillSchema } from "@/schemas/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Creates a new Agent Skill for the authenticated user.
 * Enforces slug uniqueness per user.
 *
 * @param data - Skill creation payload adhering to createSkillSchema
 * @returns Created skill database record
 * @throws {Error} When unauthenticated or validation fails
 * @decision Delegates to the skill service so the ownership and uniqueness
 * rules have one owner, shared with the AI tools.
 * @author Maruf Bepary
 */
export async function createSkill(
  data: z.infer<typeof createSkillSchema>,
): Promise<SkillRow> {
  const session = await requireSession();
  const validated = createSkillSchema.parse(data);

  return createSkillForUser(session.user.id, validated);
}
