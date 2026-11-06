import { ERROR_CODE } from "@/lib/error/error-code";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Moves a file from sourcePath to targetFolderPath (empty string or '/' for root).
 *
 * @param files - Target files
 * @param sourcePath - Target source path
 * @param targetFolderPath - Target target folder path
 * @returns Result wrapping the updated files and newPath
 * @author Maruf Bepary
 */
export function moveFile(
  files: SkillBundledFile[],
  sourcePath: string,
  targetFolderPath: string,
): Result<{ files: SkillBundledFile[]; newPath: string }, CommonError> {
  const cleanedSource = cleanPath(sourcePath);
  const cleanedFolder = cleanPath(targetFolderPath);

  const segments = cleanedSource.split("/");
  const fileName = segments[segments.length - 1];
  const newPath = cleanedFolder ? `${cleanedFolder}/${fileName}` : fileName;

  if (newPath === cleanedSource) {
    return ok({ files, newPath });
  }

  const exists = files.some(
    (f) => cleanPath(f.path).toLowerCase() === newPath.toLowerCase(),
  );
  if (exists) {
    return fail({
      code: ERROR_CODE.CONFLICT,
      message: `A file with name "${fileName}" already exists in the target destination.`,
    });
  }

  const updatedFiles = files.map((file) =>
    cleanPath(file.path) === cleanedSource ? { ...file, path: newPath } : file,
  );

  return ok({ files: updatedFiles, newPath });
}
