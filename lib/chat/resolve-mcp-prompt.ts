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
