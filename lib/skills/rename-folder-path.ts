import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Renames a folder prefix for all files contained inside it.
 */
export function renameFolderPath(
  files: SkillBundledFile[],
  oldPrefix: string,
  newPrefix: string,
): SkillBundledFile[] {
  const cleanedOld = cleanPath(oldPrefix);
  const cleanedNew = cleanPath(newPrefix);

  if (!cleanedNew || cleanedOld === cleanedNew) {
    return files;
  }

  const prefixWithSlash = `${cleanedOld}/`;

  return files.map((file) => {
    const cleanedFilePath = cleanPath(file.path);
    if (cleanedFilePath.startsWith(prefixWithSlash)) {
      const rest = cleanedFilePath.slice(prefixWithSlash.length);
      return { ...file, path: `${cleanedNew}/${rest}` };
    }
    return file;
  });
}
