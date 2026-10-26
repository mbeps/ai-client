import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Deletes an entire folder and all nested files within it.
 *
 * @param files - Target files
 * @param folderPath - Target folder path
 * @returns The resolved result
 * @author Maruf Bepary
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
