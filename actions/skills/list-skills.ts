"use server";

import { requireSession } from "@/lib/auth/require-session";
import { listSkillsForUser } from "@/lib/skills/skill-service";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Fetches all saved Agent Skills for the authenticated user, ordered by most recently updated first.
 *
 * @decision Delegates to the skill service so the ordering and ownership rules
 * have one owner, shared with the AI tools.
 * @author Maruf Bepary
 */
export async function listSkills(): Promise<SkillRow[]> {
  const session = await requireSession();

  return listSkillsForUser(session.user.id);
}
