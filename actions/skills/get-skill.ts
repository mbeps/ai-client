"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { getSkillForUser } from "@/lib/skills/skill-service";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Fetches a single Agent Skill by ID for the authenticated user.
 *
 * @decision Delegates to the skill service so the ownership rule has one
 * owner, shared with the AI tools.
 * @author Maruf Bepary
 */
export async function getSkill(id: string): Promise<SkillRow> {
  const session = await requireSession();
  const validatedId = z.string().uuid().parse(id);

  const row = await getSkillForUser(session.user.id, validatedId);

  if (!row) throw new Error("Not Found");

  return row;
}
