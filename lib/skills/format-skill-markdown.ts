import { sanitizeSkillSlug } from "./sanitize-skill-slug";

/**
 * Formats skill data as a complete SKILL.md string with YAML frontmatter.
 *
 * @param skill - Skill metadata and content.
 * @returns Serialized markdown with YAML frontmatter.
 */
export function formatSkillMarkdown(skill: {
  name: string;
  description: string;
  displayName?: string;
  content: string;
}): string {
  const frontmatter = [
    "---",
    `name: ${sanitizeSkillSlug(skill.name)}`,
    skill.displayName ? `displayName: ${skill.displayName.trim()}` : null,
    `description: ${skill.description.trim().replace(/\n+/g, " ")}`,
    "---",
    "",
    skill.content.trim(),
  ]
    .filter((line) => line !== null)
    .join("\n");

  return frontmatter;
}
