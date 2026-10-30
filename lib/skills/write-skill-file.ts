import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schemas/skill-schema";
import { addOrUpdateFile } from "@/lib/skills/add-or-update-file";
import type { SkillFileWriteResult } from "@/lib/skills/skill-file-types";
import { resolveSkillRow } from "@/lib/skills/skill-service";
import { cleanPath } from "@/lib/skills/skill-tree-utils";
import {
  assertSkillBodyWithinBudget,
  assertSkillBundleWithinBudget,
  isSkillBodyPath,
  SKILL_FILE_PATH_ERROR,
  type SkillBundleBudgetError,
  skillFilePathSchema,
} from "@/schemas/skill/skill-file";
import type { SkillBundledFile } from "@/types/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Renders the not  found  error component.
 *
 * @param name - Target name
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
const NOT_FOUND_ERROR = (name: string) => `Skill "${name}" not found.`;

/**
 * Writes one file inside a skill, creating the skill's reference bundle.
 *
 * @param userId - User identifier
 * @param idOrName - Target id or name
 * @param path - Target path
 * @param content - Text content
 * @returns The resolved result
 * @author Maruf Bepary
 */
export async function writeSkillFileForUser(
  userId: string,
  idOrName: string,
  path: string,
  content: string,
): Promise<SkillFileWriteResult | { error: string }> {
  const parsed = skillFilePathSchema.safeParse(path);
  if (!parsed.success) {
    return { error: SKILL_FILE_PATH_ERROR };
  }
  const cleanPathValue = parsed.data;

  return await db.transaction(async (tx) => {
    const existing = await resolveSkillRow(userId, idOrName, tx, true);
    if (!existing) return { error: NOT_FOUND_ERROR(idOrName) };

    const isBody = isSkillBodyPath(cleanPathValue);
    // `files` is NOT NULL with a default of [], so there is no null to guard here.
    const currentFiles = existing.files;

    // An exact match is an ordinary rewrite and is allowed. A match that differs
    // only in case would render twice in the directory tree and make the read-back
    // path ambiguous, so it is refused rather than merged.
    const existingEntry = currentFiles.find(
      (file: SkillBundledFile) =>
        cleanPath(file.path).toLowerCase() === cleanPathValue.toLowerCase(),
    );
    const caseOnlyClash =
      existingEntry !== undefined &&
      cleanPath(existingEntry.path) !== cleanPathValue &&
      !isBody;

    if (caseOnlyClash) {
      return {
        error: `A file with path "${cleanPathValue}" already exists in this skill under a different letter case.`,
      };
    }

    if (isBody) {
      try {
        assertSkillBodyWithinBudget(content);
      } catch (error) {
        return { error: (error as SkillBundleBudgetError).message };
      }

      const [row] = await tx
        .update(skill)
        .set({ content, updatedAt: new Date() })
        .where(and(eq(skill.id, existing.id), eq(skill.userId, userId)))
        .returning();

      return {
        skill: row as SkillRow,
        path: cleanPathValue,
        target: "skill-md",
        action: "updated",
      };
    }

    const nextFiles = addOrUpdateFile(currentFiles, {
      path: cleanPathValue,
      content,
    });

    try {
      assertSkillBundleWithinBudget(nextFiles);
    } catch (error) {
      return { error: (error as SkillBundleBudgetError).message };
    }

    const [row] = await tx
      .update(skill)
      .set({ files: nextFiles, updatedAt: new Date() })
      .where(and(eq(skill.id, existing.id), eq(skill.userId, userId)))
      .returning();

    return {
      skill: row as SkillRow,
      path: cleanPathValue,
      target: "bundled",
      action: existingEntry ? "updated" : "created",
    };
  });
}
