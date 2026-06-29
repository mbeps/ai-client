import type { ModelMessage } from "ai";
import { PROMPTS } from "@/constants/prompts";

/**
 * Builds the system prompt message for a chat request by composing multiple prompt layers.
 * Merges global app prompts, project-level prompts, assistant-specific prompts,
 * and adds knowledge base / attachment instructions as needed.
 * All parts are joined with double newlines for clarity.
 * Defaults to generic helpful assistant prompt if no custom prompts provided.
 *
 * @param globalPrompt - Global application system prompt (optional)
 * @param projectPrompt - Project-specific system prompt (optional)
 * @param assistantPrompt - Assistant-specific system prompt (optional)
 * @param hasKnowledgeBase - Whether knowledge base tool is available
 * @param attachmentUrls - Presigned URLs for spreadsheet files to load via MCP
 * @returns Array with single system message for model
 * @see {@link lib/chat/register-mcp-tools.ts} for MCP tool registration
 * @author Maruf Bepary
 */
export function buildSystemPrompt(
  globalPrompt: string | null | undefined,
  projectPrompt: string | null | undefined,
  assistantPrompt: string | null | undefined,
  hasKnowledgeBase: boolean,
  attachmentUrls?: { name: string; url: string }[],
): ModelMessage[] {
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

  if (attachmentUrls && attachmentUrls.length > 0) {
    const fileList = attachmentUrls
      .map((a) => `[${a.name}]: ${a.url}`)
      .join("\n");
    systemParts.push(
      `The user has attached spreadsheet files. Use the upload_file tool with the provided URL to load each file before processing:\n${fileList}`,
    );
  }

  if (systemParts.length === 0) {
    systemParts.push("You are a helpful AI assistant.");
  }

  return [{ role: "system", content: systemParts.join("\n\n") }];
}
