import { and, eq, ne } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schema";

/**
 * Throws when the user already owns a skill with the given slug.
 *
 * @param excludeId - Skill id to ignore, used when renaming an existing skill
 */
export async function assertNameAvailable(
  userId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await db
    .select({ id: skill.id })
    .from(skill)
    .where(
      and(
        eq(skill.userId, userId),
        eq(skill.name, name),
        ...(excludeId ? [ne(skill.id, excludeId)] : []),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`A skill with name "${name}" already exists.`);
  }
}
