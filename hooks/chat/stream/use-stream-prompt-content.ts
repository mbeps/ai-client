import { toast } from "sonner";
import { PROMPTS } from "@/config/prompts";
import type { BuildMetadataOptions } from "@/hooks/chat/stream/use-stream-types";
import { resolveMcpPrompt } from "@/lib/chat/resolve-mcp-prompt";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Builds the metadata object for the user message, tracking model, tools, and prompt info.
 * @author Maruf Bepary
 */
export function buildMetadata(
  options: BuildMetadataOptions,
): Record<string, unknown> {
  const metadataObj: Record<string, unknown> = {
    model: options.model,
    selectedServerIds: options.selectedServerIds,
    selectedTools: options.selectedTools,
  };

  const stringEntries: [string, string | undefined][] = [
    ["assistantId", options.selectedAssistantId],
    ["subagentModelId", options.subagentModelId],
  ];
  for (const [key, val] of stringEntries) {
    if (val) metadataObj[key] = val;
  }

  const listEntries: [string, string[] | undefined][] = [
    ["selectedKbIds", options.selectedKbIds],
    ["selectedSkillIds", options.selectedSkillIds],
  ];
  for (const [key, list] of listEntries) {
    if (list && list.length > 0) metadataObj[key] = list;
  }

  if (options.subagentsEnabled !== undefined) {
    metadataObj.subagentsEnabled = options.subagentsEnabled;
  }
  return metadataObj;
}

/**
 * Resolves a single prompt chunk from MCP server or local store.
 * @author Maruf Bepary
 */
export async function resolveSinglePromptChunk(
  promptId: string,
  prompts: Array<{ id: string; content?: string }>,
): Promise<string | undefined> {
  if (promptId.startsWith("mcp:")) {
    const parts = promptId.split(":");
    const serverId = parts[1];
    const promptName = parts.slice(2).join(":");
    try {
      return await resolveMcpPrompt(serverId, promptName);
    } catch (err) {
      logger.error("Failed to load MCP prompt", err);
      toast.error("Failed to load MCP prompt. Sending message without it.");
      return undefined;
    }
  }
  const local = prompts.find((p) => p.id === promptId);
  return local?.content || undefined;
}

/**
 * Resolves the final message content by handling MCP prompts and slash-command prompts.
 * @author Maruf Bepary
 */
export async function resolveContent(
  content: string,
  selectedPromptIds: string[] = [],
  metadataObj: Record<string, unknown> = {},
): Promise<{ fullContent: string }> {
  const meta = metadataObj;
  if (selectedPromptIds.length === 0) return { fullContent: content };

  const promptChunks: string[] = [];
  const prompts = useAppStore.getState().prompts;

  for (const promptId of selectedPromptIds) {
    const chunk = await resolveSinglePromptChunk(promptId, prompts);
    if (chunk) promptChunks.push(chunk);
  }

  meta.promptIds = selectedPromptIds;
  if (selectedPromptIds[0]) meta.promptId = selectedPromptIds[0];
  meta.userContent = content;

  if (promptChunks.length === 0) {
    return { fullContent: content };
  }

  return {
    fullContent:
      promptChunks.join(PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR) +
      PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
      content,
  };
}
