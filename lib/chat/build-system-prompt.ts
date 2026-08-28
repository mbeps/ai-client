import { PROMPTS } from "@/constants/prompts";
import type { Skill, SkillSummary, SkillBundledFile } from "@/types/skill/skill";

/**
 * Builds the system prompt for a chat request by composing multiple prompt layers.
 * Merges global app prompts, project-level prompts, assistant-specific prompts,
 * knowledge base instructions, active skills catalog (progressive disclosure),
 * and pre-selected skills.
 *
 * @param globalPrompt - Global application system prompt (optional)
 * @param projectPrompt - Project-specific system prompt (optional)
 * @param assistantPrompt - Assistant-specific system prompt (optional)
 * @param hasKnowledgeBase - Whether knowledge base tool is available
 * @param hasAttachments - Whether the thread has file attachments
 * @param availableSkills - List of available skills for dynamic progressive disclosure catalog
 * @param selectedSkills - List of user-selected skills to pre-inject
 * @param supportsTools - Whether the current model supports tool calling
 * @returns Composed system prompt string
 * @author Maruf Bepary
 */
export function buildSystemPrompt(
  globalPrompt: string | null | undefined,
  projectPrompt: string | null | undefined,
  assistantPrompt: string | null | undefined,
  hasKnowledgeBase: boolean,
  hasAttachments?: boolean,
  availableSkills?: SkillSummary[],
  selectedSkills?: Skill[] | any[],
  supportsTools?: boolean,
): string {
  const systemParts: string[] = [];

  if (globalPrompt?.trim()) {
    systemParts.push(globalPrompt.trim());
  }

  if (projectPrompt?.trim()) {
    systemParts.push(projectPrompt.trim());
  }

  if (assistantPrompt?.trim()) {
    systemParts.push(assistantPrompt.trim());
  }

  if (hasKnowledgeBase) {
    systemParts.push(PROMPTS.SYSTEM.KNOWLEDGE_BASE_TOOL_INSTRUCTION);
  }

  if (hasAttachments) {
    systemParts.push(
      "The user has attached files to this conversation. Use the get_file_url tool to obtain download links for uploaded files when you need them.",
    );
  }

  // Pre-injected user-selected skills
  if (selectedSkills && selectedSkills.length > 0) {
    for (const s of selectedSkills) {
      let skillText = `## Active Skill: ${s.displayName} (${s.name})\n${s.content}`;
      const files = (s.files as SkillBundledFile[]) ?? [];
      if (files.length > 0) {
        skillText +=
          "\n\n### Bundled Reference Files:\n" +
          files
            .map((f) => `#### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
            .join("\n\n");
      }
      systemParts.push(skillText);
    }
  }

  // Available skills catalog for progressive disclosure via load_skill tool
  if (supportsTools && availableSkills && availableSkills.length > 0) {
    const catalogXml = availableSkills
      .map(
        (s) =>
          `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n  </skill>`,
      )
      .join("\n");

    const skillsInstruction = `## Available Agent Skills
You have access to specialized agent skills for domain workflows.
If a task matches an available skill's description, call the \`load_skill\` tool with the skill's name to retrieve its full procedural instructions before responding.

<available_skills>
${catalogXml}
</available_skills>`;

    systemParts.push(skillsInstruction);
  }

  if (systemParts.length === 0) {
    systemParts.push("You are a helpful AI assistant.");
  }

  return systemParts.join("\n\n---\n\n");
}
