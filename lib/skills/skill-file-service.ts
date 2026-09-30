import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { skill } from "@/drizzle/schema";
import { resolveSkillRow } from "@/lib/skills/skill-service";
import {
  addOrUpdateFile,
  cleanPath,
  deleteFile,
} from "@/lib/skills/skill-tree-utils";
import {
  assertSkillBodyWithinBudget,
  assertSkillBundleWithinBudget,
  isSkillBodyPath,
  SKILL_FILE_PATH_ERROR,
  type SkillBundleBudgetError,
  skillFilePathSchema,
} from "@/schemas/skill/skill-file";
import type { SkillRow } from "@/types/skill/skill-row";

/** Where a path is stored. The body lives in its own column, not in `files`. */
export type SkillFileTarget = "skill-md" | "bundled";

/** Result of a successful write, including whether the path was new. */
export interface SkillFileWriteResult {
  skill: SkillRow;
  path: string;
  target: SkillFileTarget;
  action: "created" | "updated";
}

/** A single file read back, with its size so a caller can budget a rewrite. */
export interface SkillFileReadResult {
  path: string;
  bytes: number;
  target: SkillFileTarget;
  content: string;
}

const NOT_FOUND_ERROR = (name: string) => `Skill "${name}" not found.`;

/**
 * Writes one file inside a skill, creating the skill's reference bundle.
 *
 * @decision The body and the reference bundle are written through this one
 * function so a single set of path and budget guards covers both. Two write
 * paths means two places for the rules to diverge.
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

  const existing = await resolveSkillRow(userId, idOrName);
  if (!existing) return { error: NOT_FOUND_ERROR(idOrName) };

  const isBody = isSkillBodyPath(cleanPathValue);
  // `files` is NOT NULL with a default of [], so there is no null to guard here.
  const currentFiles = existing.files;

  // An exact match is an ordinary rewrite and is allowed. A match that differs
  // only in case would render twice in the directory tree and make the read-back
  // path ambiguous, so it is refused rather than merged.
  const existingEntry = currentFiles.find(
    (file) =>
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

    const [row] = await db
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

  const [row] = await db
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
}

/**
 * Reads one file out of a skill, or `null` when the skill or path is missing.
 */
export async function readSkillFileForUser(
  userId: string,
  idOrName: string,
  path: string,
): Promise<SkillFileReadResult | null> {
  const parsed = skillFilePathSchema.safeParse(path);
  if (!parsed.success) return null;

  const existing = await resolveSkillRow(userId, idOrName);
  if (!existing) return null;

  const cleanPathValue = parsed.data;
  if (isSkillBodyPath(cleanPathValue)) {
    return {
      path: cleanPathValue,
      bytes: existing.content.length,
      target: "skill-md",
      content: existing.content,
    };
  }

  const found = existing.files.find(
    (file) => cleanPath(file.path) === cleanPathValue,
  );
  if (!found) return null;

  return {
    path: cleanPathValue,
    bytes: found.content.length,
    target: "bundled",
    content: found.content,
  };
}

/**
 * Lists every file in a skill with its size, so a caller can plan a rewrite
 * without reading the whole bundle.
 */
export async function listSkillFilesForUser(
  userId: string,
  idOrName: string,
): Promise<{ manifest: { path: string; bytes: number }[] } | null> {
  const existing = await resolveSkillRow(userId, idOrName);
  if (!existing) return null;

  const files = existing.files;
  return {
    manifest: [
      { path: "SKILL.md", bytes: existing.content.length },
      ...files.map((file) => ({
        path: cleanPath(file.path),
        bytes: file.content.length,
      })),
    ],
  };
}

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
