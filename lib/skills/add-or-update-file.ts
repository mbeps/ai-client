import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Adds or updates a file in the bundled files list.
 */
export function addOrUpdateFile(
  files: SkillBundledFile[],
  newFile: SkillBundledFile,
): SkillBundledFile[] {
  const cleanedTarget = cleanPath(newFile.path);
  const exists = files.some((f) => cleanPath(f.path) === cleanedTarget);

  if (exists) {
    return files.map((f) =>
      cleanPath(f.path) === cleanedTarget
        ? { ...f, content: newFile.content }
        : f,
    );
  }

  return [...files, { path: cleanedTarget, content: newFile.content }];
}
