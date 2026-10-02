"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Toggles the enabled status of an Agent Skill.
 *
 * @author Maruf Bepary
 */
export async function toggleSkillEnabled(
  id: string,
  enabled: boolean,
): Promise<SkillRow> {
  const session = await requireSession();
  const validatedId = z.string().uuid().parse(id);

  const [row] = await db
    .update(skill)
    .set({
      enabled,
      updatedAt: new Date(),
    })
    .where(and(eq(skill.id, validatedId), eq(skill.userId, session.user.id)))
    .returning();

  if (!row) throw new Error("Not Found");

  return row as SkillRow;
}
