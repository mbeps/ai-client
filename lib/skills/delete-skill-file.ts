import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schemas/skill-schema";
import { deleteFile } from "@/lib/skills/delete-file";
import { resolveSkillRow } from "@/lib/skills/skill-service";
import {
  isSkillBodyPath,
  SKILL_FILE_PATH_ERROR,
  skillFilePathSchema,
} from "@/schemas/skill/skill-file";
import type { SkillRow } from "@/types/skill/skill-row";

const NOT_FOUND_ERROR = (name: string) => `Skill "${name}" not found.`;

/**
 * Removes one bundled reference file.
 *
 * Refuses `SKILL.md`: `content` is `NOT NULL`, so a skill cannot exist without a
 * body, and there is no representable state for "no body".
 */
export async function deleteSkillFileForUser(
  userId: string,
  idOrName: string,
  path: string,
): Promise<{ skill: SkillRow; path: string } | { error: string }> {
  const parsed = skillFilePathSchema.safeParse(path);
  if (!parsed.success) {
    return { error: SKILL_FILE_PATH_ERROR };
  }
  const cleanPathValue = parsed.data;

  if (isSkillBodyPath(cleanPathValue)) {
    return {
      error:
        'SKILL.md cannot be deleted. Use update_skill with a "content" value to replace the body instead.',
    };
  }

  const existing = await resolveSkillRow(userId, idOrName);
  if (!existing) return { error: NOT_FOUND_ERROR(idOrName) };

  const currentFiles = existing.files;
  const remains = deleteFile(currentFiles, cleanPathValue);
  if (remains.length === currentFiles.length) {
    return {
      error: `File "${cleanPathValue}" not found in skill "${idOrName}".`,
    };
  }

  const [row] = await db
    .update(skill)
    .set({ files: remains, updatedAt: new Date() })
    .where(and(eq(skill.id, existing.id), eq(skill.userId, userId)))
    .returning();

  return { skill: row as SkillRow, path: cleanPathValue };
}
