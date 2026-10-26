import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Moves a file from sourcePath to targetFolderPath (empty string or '/' for root).
 *
 * @param files - Target files
 * @param sourcePath - Target source path
 * @param targetFolderPath - Target target folder path
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function moveFile(
  files: SkillBundledFile[],
  sourcePath: string,
  targetFolderPath: string,
): { files: SkillBundledFile[]; newPath: string } {
  const cleanedSource = cleanPath(sourcePath);
  const cleanedFolder = cleanPath(targetFolderPath);

  const segments = cleanedSource.split("/");
  const fileName = segments[segments.length - 1];
  const newPath = cleanedFolder ? `${cleanedFolder}/${fileName}` : fileName;

  if (newPath === cleanedSource) {
    return { files, newPath };
  }

  const exists = files.some(
    (f) => cleanPath(f.path).toLowerCase() === newPath.toLowerCase(),
  );
  if (exists) {
    throw new Error(
      `A file with name "${fileName}" already exists in the target destination.`,
    );
  }

  const updatedFiles = files.map((file) =>
    cleanPath(file.path) === cleanedSource ? { ...file, path: newPath } : file,
  );

  return { files: updatedFiles, newPath };
}
