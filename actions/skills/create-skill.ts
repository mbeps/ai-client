"use server";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { createSkillSchema } from "@/schemas/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Creates a new Agent Skill for the authenticated user.
 * Enforces slug uniqueness per user.
 *
 * @author Maruf Bepary
 */
export async function createSkill(
  data: z.infer<typeof createSkillSchema>,
): Promise<SkillRow> {
  const session = await requireSession();
  const validated = createSkillSchema.parse(data);

  // Check slug uniqueness for user
  const existing = await db
    .select({ id: skill.id })
    .from(skill)
    .where(
      and(eq(skill.userId, session.user.id), eq(skill.name, validated.name)),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`A skill with name "${validated.name}" already exists.`);
  }

  const [row] = await db
    .insert(skill)
    .values({
      userId: session.user.id,
      name: validated.name,
      displayName: validated.displayName,
      description: validated.description,
      content: validated.content,
      files: validated.files,
      enabled: validated.enabled,
    })
    .returning();

  return row as SkillRow;
}
