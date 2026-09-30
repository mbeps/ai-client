"use server";

import { requireSession } from "@/lib/auth/require-session";
import { deleteSkillForUser } from "@/lib/skills/skill-service";

/**
 * Deletes one or more Agent Skills, verifying ownership by the authenticated user.
 *
 * @decision Delegates to the skill service so the ownership rule has one
 * owner, shared with the AI tools. The empty-input short circuit and the
 * `Not Found` throw match the behaviour the entity delete factory had.
 * @author Maruf Bepary
 */
export async function deleteSkill(
  idOrIds: string | string[],
): Promise<{ deletedCount: number }> {
  const session = await requireSession();
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

  if (ids.length === 0) {
    return { deletedCount: 0 };
  }

  const counts = await Promise.all(
    ids.map((id) => deleteSkillForUser(session.user.id, id)),
  );
  const deletedCount = counts.reduce(
    (sum, result) => sum + result.deletedCount,
    0,
  );

  if (deletedCount === 0) throw new Error("Not Found");

  return { deletedCount };
}
