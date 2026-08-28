"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schema";
import { and, eq, ne } from "drizzle-orm";
import { updateSkillSchema } from "@/schemas/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";
import { z } from "zod";

/**
 * Updates an existing Agent Skill for the authenticated user.
 * Validates slug uniqueness if name is modified.
 *
 * @author Maruf Bepary
 */
export async function updateSkill(
  id: string,
  data: z.infer<typeof updateSkillSchema>,
): Promise<SkillRow> {
  const session = await requireSession();
  const validatedId = z.string().uuid().parse(id);
  const validatedData = updateSkillSchema.parse(data);

  if (validatedData.name) {
    const existing = await db
      .select({ id: skill.id })
      .from(skill)
      .where(
        and(
          eq(skill.userId, session.user.id),
          eq(skill.name, validatedData.name),
          ne(skill.id, validatedId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error(
        `A skill with name "${validatedData.name}" already exists.`,
      );
    }
  }

  const [row] = await db
    .update(skill)
    .set({
      ...(validatedData.name ? { name: validatedData.name } : {}),
      ...(validatedData.displayName
        ? { displayName: validatedData.displayName }
        : {}),
      ...(validatedData.description
        ? { description: validatedData.description }
        : {}),
      ...(validatedData.content !== undefined
        ? { content: validatedData.content }
        : {}),
      ...(validatedData.files !== undefined
        ? { files: validatedData.files }
        : {}),
      ...(validatedData.enabled !== undefined
        ? { enabled: validatedData.enabled }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(skill.id, validatedId), eq(skill.userId, session.user.id)))
    .returning();

  if (!row) throw new Error("Not Found");

  return row as SkillRow;
}
