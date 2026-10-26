import {
  type ParsedSkill,
  parseSkillMarkdown,
} from "@/lib/skills/parse-skill-markdown";
import { parseZipBuffer, type ZipEntry } from "@/lib/skills/parse-zip-buffer";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Determines whether os artifact.
 *
 * @param cleanPath - Target clean path
 * @returns The resolved result
 * @author Maruf Bepary
 */
function isOsArtifact(cleanPath: string): boolean {
  return (
    cleanPath.startsWith("__MACOSX") ||
    cleanPath.includes("/.DS_Store") ||
    cleanPath.endsWith(".DS_Store")
  );
}

/**
 * Determines whether all non-OS files share the common root folder prefix of SKILL.md.
 *
 * @param entries - Target entries
 * @param skillEntry - Target skill entry
 * @returns The resolved result
 * @author Maruf Bepary
 */
function determineRootPrefix(
  entries: ZipEntry[],
  skillEntry?: ZipEntry,
): string {
  if (!skillEntry) return "";
  const slashIdx = skillEntry.path.indexOf("/");
  if (slashIdx === -1) return "";
  const prefix = skillEntry.path.substring(0, slashIdx + 1);

  const nonOsEntries = entries.filter((e) => {
    const clean = e.path.replace(/^(\.\/|\/)/, "");
    return !isOsArtifact(clean) && !clean.endsWith("/");
  });

  return nonOsEntries.every((e) => e.path.startsWith(prefix)) ? prefix : "";
}

/**
 * Resolves entry relative path.
 *
 * @param cleanPath - Target clean path
 * @param rootPrefix - Target root prefix
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveEntryRelativePath(
  cleanPath: string,
  rootPrefix: string,
): string | null {
  if (isOsArtifact(cleanPath)) {
    return null;
  }
  const rel =
    rootPrefix && cleanPath.startsWith(rootPrefix)
      ? cleanPath.substring(rootPrefix.length)
      : cleanPath;
  return !rel || rel.endsWith("/") ? null : rel;
}

/**
 * Filters out OS noise and extracts bundled reference files relative to the skill root.
 *
 * @param entries - Target entries
 * @param skillEntry - Target skill entry
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveBundledFiles(
  entries: ZipEntry[],
  skillEntry?: ZipEntry,
): SkillBundledFile[] {
  const rootPrefix = determineRootPrefix(entries, skillEntry);
  const files: SkillBundledFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory || (skillEntry && entry.path === skillEntry.path)) {
      continue;
    }

    const cleanPath = entry.path.replace(/^(\.\/|\/)/, "");
    const relativePath = resolveEntryRelativePath(cleanPath, rootPrefix);
    if (relativePath) {
      files.push({
        path: relativePath,
        content: entry.data.toString("utf8"),
      });
    }
  }

  return files;
}

/**
 * Extracts a skill from an uploaded ZIP archive containing SKILL.md and optional reference files.
 *
 * @param buffer - Raw ZIP archive buffer or Uint8Array.
 * @param fallbackName - Default name to use if frontmatter name is absent.
 * @returns Parsed skill object with markdown content and bundled files.
 */
export function extractSkillFromZip(
  buffer: Buffer | Uint8Array,
  fallbackName = "uploaded-skill",
): ParsedSkill {
  const entries = parseZipBuffer(buffer);

  // Locate primary SKILL.md (case-insensitive) or any root .md file
  let skillEntry = entries.find(
    (e) =>
      !e.isDirectory &&
      (e.path.toLowerCase() === "skill.md" ||
        e.path.toLowerCase().endsWith("/skill.md")),
  );

  if (!skillEntry) {
    skillEntry = entries.find(
      (e) => !e.isDirectory && e.path.toLowerCase().endsWith(".md"),
    );
  }

  const rawMarkdown = skillEntry ? skillEntry.data.toString("utf8") : "";
  const parsed = parseSkillMarkdown(rawMarkdown, fallbackName);
  const files = resolveBundledFiles(entries, skillEntry);

  return {
    ...parsed,
    files,
  };
}
