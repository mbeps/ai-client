import { PROMPTS } from "@/constants/prompts";
import type { Prompt } from "@/types/prompt/prompt";
import { toast } from "sonner";

/**
 * Fetches an MCP prompt from a remote server and returns its text content.
 * Handles different content shapes (string, { type: "text", text }, { text }).
 *
 * @param serverId - The MCP server ID.
 * @param promptName - The prompt name to fetch.
 * @returns The concatenated prompt messages as a single string.
 * @throws Logs error and shows toast on failure — caller should handle gracefully.
 * @author Maruf Bepary
 */
export async function resolveMcpPrompt(
  serverId: string,
  promptName: string,
): Promise<string> {
  const { getMcpPrompt } = await import("@/lib/actions/mcp/get-mcp-prompt");
  const mcpPromptResult = await getMcpPrompt(serverId, promptName);
  const mcpContent = (mcpPromptResult as any).messages
    .map((m: any) => {
      if (typeof m.content === "string") return m.content;
      if (m.content?.type === "text") return m.content.text;
      if (m.content?.text) return m.content.text;
      return "";
    })
    .join("\n\n");

  return mcpContent;
}

/**
 * Resolves a slash-command prompt by ID, prepending its content to the user's message.
 *
 * @param promptId - The prompt ID to look up.
 * @param userContent - The user's original message content.
 * @param prompts - The list of available prompts from the store.
 * @returns The composed full content (prompt + separator + userContent).
 * @author Maruf Bepary
 */
export function resolveSlashPrompt(
  promptId: string,
  userContent: string,
  prompts: Prompt[],
): {
  fullContent: string;
  metadata: { promptId: string; userContent: string };
} {
  const selectedPrompt = prompts.find((p) => p.id === promptId);
  if (!selectedPrompt) {
    return { fullContent: userContent, metadata: { promptId, userContent } };
  }

  return {
    fullContent:
      selectedPrompt.content +
      PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
      userContent,
    metadata: { promptId, userContent },
  };
}
