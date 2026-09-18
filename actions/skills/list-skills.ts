"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Fetches all saved Agent Skills for the authenticated user, ordered by most recently updated first.
 *
 * @author Maruf Bepary
 */
export async function listSkills(): Promise<SkillRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(skill)
    .where(eq(skill.userId, session.user.id))
    .orderBy(desc(skill.updatedAt)) as Promise<SkillRow[]>;
}
