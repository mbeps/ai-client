import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Extracts all unique folder paths from files and emptyFolders.
 *
 * @param files - Target files
 * @param emptyFolders - Target empty folders
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function getAllFolders(
  files: SkillBundledFile[],
  emptyFolders: string[] = [],
): string[] {
  const folders = new Set<string>();

  for (const empty of emptyFolders) {
    const cleaned = cleanPath(empty);
    if (cleaned) folders.add(cleaned);
  }

  for (const file of files) {
    const cleaned = cleanPath(file.path);
    const segments = cleaned.split("/");
    if (segments.length > 1) {
      for (let i = 1; i < segments.length; i++) {
        folders.add(segments.slice(0, i).join("/"));
      }
    }
  }

  return Array.from(folders).sort();
}
