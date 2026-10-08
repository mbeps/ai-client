import { PROMPTS } from "@/config/prompts";
import {
  formatActiveSkill,
  formatSkillCatalog,
} from "@/lib/skills/build-skill-prompt";
import type { Skill, SkillSummary } from "@/types/skill/skill";

/**
 * Optional layers composed into the system prompt on top of the three
 * project-scoped prompts.
 */
export interface SystemPromptOptions {
  attachmentNames?: string[];
  availableSkills?: SkillSummary[];
  selectedSkills?: Skill[] | any[];
  supportsTools?: boolean;
  userContext?: { name?: string | null; email?: string | null };
  userMemories?: string[];
}

/**
 * Builds the system prompt for a chat request by composing multiple prompt layers.
 * Merges the authenticated user's identity, global app prompts, project-level
 * prompts, assistant-specific prompts, knowledge base instructions, active
 * skills catalog (progressive disclosure), and pre-selected skills.
 *
 * @param globalPrompt - Global application system prompt (optional)
 * @param projectPrompt - Project-specific system prompt (optional)
 * @param assistantPrompt - Assistant-specific system prompt (optional)
 * @param hasKnowledgeBase - Whether knowledge base tool is available
 * @param options - Optional layers: attachments, skills, tool support, user identity
 * @returns Composed system prompt string
 * @author Maruf Bepary
 */
export function buildSystemPrompt(
  globalPrompt: string | null | undefined,
  projectPrompt: string | null | undefined,
  assistantPrompt: string | null | undefined,
  hasKnowledgeBase: boolean,
  options: SystemPromptOptions = {},
): string {
  const {
    attachmentNames,
    availableSkills,
    selectedSkills,
    supportsTools,
    userContext,
    userMemories,
  } = options;

  const systemParts: string[] = [];

  // Identity goes first so later prompt layers can address the user directly,
  // regardless of what a custom prompt contains.
  if (userContext?.name?.trim() || userContext?.email?.trim()) {
    const identity = [
      userContext.name?.trim() && `- Name: ${userContext.name.trim()}`,
      userContext.email?.trim() && `- Email: ${userContext.email.trim()}`,
    ].filter(Boolean);
    systemParts.push(`## About the User\n${identity.join("\n")}`);
  }

  if (userMemories && userMemories.length > 0) {
    const memoryList = userMemories.map((m) => `- ${m}`).join("\n");
    systemParts.push(
      `## User Memory\nThe following preferences and facts are remembered from previous conversations:\n${memoryList}\n\nApply these memories when answering and tailor your responses accordingly. When the user shares new enduring preferences or facts, use the save_memory tool to record them.`,
    );
  }

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

  if (attachmentNames && attachmentNames.length > 0) {
    const fileList = attachmentNames.map((n) => `- ${n}`).join("\n");
    systemParts.push(
      `The user has attached the following files to this conversation:\n${fileList}\n\nUse the get_file_url tool with the exact file name to obtain a download link when you need to access a file. If an MCP tool requires a local file path (e.g. Excel tools), first get the download URL using get_file_url, then pass that URL to the MCP file ingestion tool (such as upload_file with file_content=<URL> and filename=<name>) to stage the file, and use the returned local file path with other tools.`,
    );
  }

  // Pre-injected user-selected skills
  for (const s of selectedSkills ?? []) {
    systemParts.push(formatActiveSkill(s));
  }

  // Available skills catalog for progressive disclosure via load_skill tool
  if (supportsTools && availableSkills && availableSkills.length > 0) {
    systemParts.push(formatSkillCatalog(availableSkills));
  }

  if (systemParts.length === 0) {
    systemParts.push("You are a helpful AI assistant.");
  }

  return systemParts.join("\n\n---\n\n");
}
