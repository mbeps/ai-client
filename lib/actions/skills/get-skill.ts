"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { SkillRow } from "@/types/skill/skill-row";
import { z } from "zod";

/**
 * Fetches a single Agent Skill by ID for the authenticated user.
 *
 * @author Maruf Bepary
 */
export async function getSkill(id: string): Promise<SkillRow> {
  const session = await requireSession();
  const validatedId = z.string().uuid().parse(id);

  const [row] = await db
    .select()
    .from(skill)
    .where(and(eq(skill.id, validatedId), eq(skill.userId, session.user.id)))
    .limit(1);

  if (!row) throw new Error("Not Found");

  return row as SkillRow;
}
