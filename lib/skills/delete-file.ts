import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Deletes an individual file by relative path.
 */
export function deleteFile(
  files: SkillBundledFile[],
  targetPath: string,
): SkillBundledFile[] {
  const cleanedTarget = cleanPath(targetPath);
  return files.filter((f) => cleanPath(f.path) !== cleanedTarget);
}
