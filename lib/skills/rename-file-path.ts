import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Renames an individual file path within the bundled files array.
 */
export function renameFilePath(
  files: SkillBundledFile[],
  oldPath: string,
  newPath: string,
): SkillBundledFile[] {
  const cleanedOld = cleanPath(oldPath);
  const cleanedNew = cleanPath(newPath);

  if (!cleanedNew || cleanedOld === cleanedNew) {
    return files;
  }

  return files.map((file) => {
    if (cleanPath(file.path) === cleanedOld) {
      return { ...file, path: cleanedNew };
    }
    return file;
  });
}
