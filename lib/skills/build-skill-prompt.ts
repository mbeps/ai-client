import type {
  Skill,
  SkillBundledFile,
  SkillSummary,
} from "@/types/skill/skill";

/**
 * Formats a pre-injected skill, including its bundled reference files.
 *
 * @param skill - The skill row to format
 * @returns The skill instructions as a system prompt section
 * @author Maruf Bepary
 */
export function formatActiveSkill(skill: Skill | any): string {
  const files = (skill.files as SkillBundledFile[]) ?? [];
  if (files.length === 0) {
    return `## Active Skill: ${skill.displayName} (${skill.name})\n${skill.content}`;
  }
  const filesText =
    "\n\n### Bundled Reference Files:\n" +
    files
      .map((f) => `#### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join("\n\n");
  return `## Active Skill: ${skill.displayName} (${skill.name})\n${skill.content}${filesText}`;
}

/**
 * Formats the skills catalog that advertises dynamically loadable skills.
 *
 * @param availableSkills - Skills reachable through the `load_skill` tool
 * @returns The catalog as a system prompt section
 * @author Maruf Bepary
 */
export function formatSkillCatalog(availableSkills: SkillSummary[]): string {
  const catalogXml = availableSkills
    .map(
      (s) =>
        `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n  </skill>`,
    )
    .join("\n");

  return `## Available Agent Skills
You have access to specialized agent skills for domain workflows.
If a task matches an available skill's description, call the \`load_skill\` tool with the skill's name to retrieve its full procedural instructions before responding.

<available_skills>
${catalogXml}
</available_skills>`;
}
