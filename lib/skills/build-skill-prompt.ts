import type {
  Skill,
  SkillBundledFile,
  SkillSummary,
} from "@/types/skill/skill";

/**
 * Wraps content in a Markdown code fence that the content cannot escape from.
 *
 * @decision A skill file is written by a language model, and its content is
 * interpolated straight into the system prompt. A triple backtick inside the
 * content would close the block early and let the rest of the file pose as
 * instructions. The fence is therefore always one backtick longer than the
 * longest run in the content, which is the rule the CommonMark parser uses.
 * @author Maruf Bepary
 */
export function fenceBlock(content: string, language?: string): string {
  const longestRun = Math.max(
    0,
    ...(content.match(/`+/g) ?? []).map((run) => run.length),
  );
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  // A trailing newline stops a content run from merging with the closing fence.
  return `${fence}${language ?? ""}\n${content}\n${fence}`;
}

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
