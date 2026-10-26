import type { SkillSummary } from "@/types/skill/skill";

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
