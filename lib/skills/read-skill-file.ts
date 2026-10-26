import type { SkillFileReadResult } from "@/lib/skills/skill-file-types";
import { resolveSkillRow } from "@/lib/skills/skill-service";
import { cleanPath } from "@/lib/skills/skill-tree-utils";
import {
  isSkillBodyPath,
  skillFilePathSchema,
} from "@/schemas/skill/skill-file";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Reads one file out of a skill, or `null` when the skill or path is missing.
 *
 * @param userId - User identifier
 * @param idOrName - Target id or name
 * @param path - Target path
 * @returns The resolved result
 * @author Maruf Bepary
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
    (file: SkillBundledFile) => cleanPath(file.path) === cleanPathValue,
  );
  if (!found) return null;

  return {
    path: cleanPathValue,
    bytes: found.content.length,
    target: "bundled",
    content: found.content,
  };
}
