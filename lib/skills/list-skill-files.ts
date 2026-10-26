import { resolveSkillRow } from "@/lib/skills/skill-service";
import { cleanPath } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Lists every file in a skill with its size, so a caller can plan a rewrite
 * without reading the whole bundle.
 */
export async function listSkillFilesForUser(
  userId: string,
  idOrName: string,
): Promise<{ manifest: { path: string; bytes: number }[] } | null> {
  const existing = await resolveSkillRow(userId, idOrName);
  if (!existing) return null;

  const files = existing.files;
  return {
    manifest: [
      { path: "SKILL.md", bytes: existing.content.length },
      ...files.map((file: SkillBundledFile) => ({
        path: cleanPath(file.path),
        bytes: file.content.length,
      })),
    ],
  };
}
