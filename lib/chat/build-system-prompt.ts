import { PROMPTS } from "@/constants/prompts";

/**
 * Builds the system prompt for a chat request by composing multiple prompt layers.
 * Merges global app prompts, project-level prompts, assistant-specific prompts,
 * and adds knowledge base / attachment instructions as needed.
 * Non-empty layers are joined with `\n\n---\n\n` delimiters so the model can
 * distinguish prompt sources. Defaults to a generic helpful assistant prompt if
 * no custom prompts are provided. Returns a plain string — the route passes it
 * to `streamText({ system })` (AI SDK native system parameter).
 *
 * @param globalPrompt - Global application system prompt (optional)
 * @param projectPrompt - Project-specific system prompt (optional)
 * @param assistantPrompt - Assistant-specific system prompt (optional)
 * @param hasKnowledgeBase - Whether knowledge base tool is available
 * @param hasAttachments - Whether the thread has file attachments
 * @returns Composed system prompt string
 * @see {@link lib/chat/register-mcp-tools.ts} for MCP tool registration
 * @author Maruf Bepary
 */
export function buildSystemPrompt(
  globalPrompt: string | null | undefined,
  projectPrompt: string | null | undefined,
  assistantPrompt: string | null | undefined,
  hasKnowledgeBase: boolean,
  hasAttachments?: boolean,
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

  if (systemParts.length === 0) {
    systemParts.push("You are a helpful AI assistant.");
  }

  return systemParts.join("\n\n---\n\n");
}
