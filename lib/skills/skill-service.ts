import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schemas/skill-schema";
import type { SkillRow } from "@/types/skill/skill-row";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a skill by uuid or slug, always scoped to the owner. Returns `null` for both a missing skill and a skill owned by someone else, so a caller cannot probe for another user's skills by comparing the two cases.
 *
 * @param userId - User identifier
 * @param idOrName - Target id or name
 * @param executor - Optional database or transaction client
 * @param forUpdate - Whether to acquire a row-level lock (FOR UPDATE)
 * @returns The resolved result
 * @author Maruf Bepary
 */
export async function resolveSkillRow(
  userId: string,
  idOrName: string,
  executor: any = db,
  forUpdate = false,
): Promise<SkillRow | null> {
  const byId = UUID_PATTERN.test(idOrName);
  let query = executor
    .select()
    .from(skill)
    .where(
      and(
        eq(skill.userId, userId),
        byId ? eq(skill.id, idOrName) : eq(skill.name, idOrName),
      ),
    );

  if (forUpdate) {
    query = query.for("update");
  }

  const [row] = await query.limit(1);

  return (row as SkillRow) ?? null;
}
