import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Deletes an entire folder and all nested files within it.
 */
export function deleteFolderPath(
  files: SkillBundledFile[],
  folderPath: string,
): SkillBundledFile[] {
  const cleanedFolder = cleanPath(folderPath);
  const prefixWithSlash = `${cleanedFolder}/`;

  return files.filter((file) => {
    const cleanedFilePath = cleanPath(file.path);
    return !cleanedFilePath.startsWith(prefixWithSlash);
  });
}
