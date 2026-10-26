import { fenceBlock } from "@/lib/skills/fence-block";
import type { Skill, SkillBundledFile } from "@/types/skill/skill";

/**
 * Formats a pre-injected skill, including its bundled reference files.
 *
 * @param skill - The skill row to format
 * @returns The skill instructions as a system prompt section
 * @author Maruf Bepary
 */
export function formatActiveSkill(skill: Skill | any): string {
  const files = skill.files as SkillBundledFile[];
  if (!files || files.length === 0) {
    return `## Active Skill: ${skill.displayName} (${skill.name})\n${skill.content}`;
  }
  const filesText =
    "\n\n### Bundled Reference Files:\n" +
    files
      .map((f) => `#### File: ${f.path}\n${fenceBlock(f.content)}`)
      .join("\n\n");
  return `## Active Skill: ${skill.displayName} (${skill.name})\n${skill.content}${filesText}`;
}
