import { and, desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schemas/skill-schema";
import { assertNameAvailable } from "@/lib/skills/skill-name-availability";
import { resolveSkillRow } from "@/lib/skills/skill-service";
import type { CreateSkillInput, UpdateSkillInput } from "@/schemas/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Fetches every skill owned by the user, most recently updated first.
 */
export async function listSkillsForUser(userId: string): Promise<SkillRow[]> {
  return db
    .select()
    .from(skill)
    .where(eq(skill.userId, userId))
    .orderBy(desc(skill.updatedAt)) as Promise<SkillRow[]>;
}

/**
 * Fetches a single skill owned by the user, or `null`.
 */
export async function getSkillForUser(
  userId: string,
  idOrName: string,
): Promise<SkillRow | null> {
  return resolveSkillRow(userId, idOrName);
}

/**
 * Creates a skill for the user, rejecting a slug the user already holds.
 */
export async function createSkillForUser(
  userId: string,
  data: CreateSkillInput,
): Promise<SkillRow> {
  await assertNameAvailable(userId, data.name);

  const [row] = await db
    .insert(skill)
    .values({
      userId,
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      content: data.content,
      files: data.files,
      enabled: data.enabled,
    })
    .returning();

  return row as SkillRow;
}

/**
 * Applies a partial update to a skill owned by the user.
 *
 * Returns `null` when the skill is missing or owned by someone else.
 */
export async function updateSkillForUser(
  userId: string,
  idOrName: string,
  data: UpdateSkillInput,
): Promise<SkillRow | null> {
  const existing = await resolveSkillRow(userId, idOrName);
  if (!existing) return null;

  if (data.name) {
    await assertNameAvailable(userId, data.name, existing.id);
  }

  const [row] = await db
    .update(skill)
    .set({
      ...(data.name ? { name: data.name } : {}),
      ...(data.displayName ? { displayName: data.displayName } : {}),
      ...(data.description ? { description: data.description } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.files !== undefined ? { files: data.files } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(skill.id, existing.id), eq(skill.userId, userId)))
    .returning();

  return (row as SkillRow) ?? null;
}

/**
 * Deletes a skill owned by the user and reports how many rows went.
 */
export async function deleteSkillForUser(
  userId: string,
  idOrName: string,
): Promise<{ deletedCount: number }> {
  const existing = await resolveSkillRow(userId, idOrName);
  if (!existing) return { deletedCount: 0 };

  const deleted = await db
    .delete(skill)
    .where(and(eq(skill.id, existing.id), eq(skill.userId, userId)))
    .returning({ id: skill.id });

  return { deletedCount: deleted.length };
}
