import { tool } from "ai";
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";
import { hybridSearch } from "@/lib/rag/retrieve";
import {
  manageArtifactSchema,
  searchKnowledgeBaseSchema,
} from "@/schemas/chat";
import { PROMPTS } from "@/constants/prompts";

// The server type accepted by getMcpTools (mirror the parameter type)
type McpServerParam = Parameters<typeof getMcpTools>[0][number];

export async function registerMcpTools(
  scopedServers: McpServerParam[],
  selectedTools: string[] | undefined,
  isArtifactToolSelected: boolean,
  activeKbId: string | null,
): Promise<{ mcpTools: Record<string, any>; mcpCleanup: () => Promise<void> }> {
  let mcpTools: Record<string, any> = {};
  let mcpCleanup = async () => {};

  if (scopedServers.length > 0) {
    try {
      const result = await getMcpTools(scopedServers);

      if (selectedTools && selectedTools.length > 0) {
        const filteredTools: Record<string, any> = {};
        for (const [name, toolDef] of Object.entries(result.tools)) {
          const isSelected = selectedTools.some((id) => {
            const [, type, tName] = id.split(":");
            return type === "tool" && tName === name;
          });
          if (isSelected) {
            filteredTools[name] = toolDef;
          }
        }
        mcpTools = filteredTools;
      } else {
        mcpTools = result.tools;
      }

      mcpCleanup = result.cleanup;
    } catch (error) {
      console.warn("[MCP] Failed to load tools:", error);
    }
  }

  if (isArtifactToolSelected) {
    mcpTools["manage_artifact"] = tool({
      description: PROMPTS.TOOLS.MANAGE_ARTIFACT.DESCRIPTION,
      parameters: manageArtifactSchema,
      // @ts-expect-error Vercel AI SDK type mismatch with internal tools
      execute: async (args: any) => {
        const VALID_TYPES = ["markdown", "spreadsheet", "html", "mermaid"];
        const normalizedArgs = {
          type: VALID_TYPES.includes(args.type) ? args.type : "markdown",
          title: args.title || PROMPTS.TOOLS.MANAGE_ARTIFACT.DEFAULT_TITLE,
          content: args.content || args.text || "",
        };
        return {
          success: true,
          message: PROMPTS.TOOLS.MANAGE_ARTIFACT.SUCCESS_MESSAGE,
          artifact: normalizedArgs,
        };
      },
    });
  }

  if (activeKbId) {
    const kbId = activeKbId;
    mcpTools["search_knowledge_base"] = tool({
      description: PROMPTS.TOOLS.SEARCH_KNOWLEDGE_BASE.DESCRIPTION,
      parameters: searchKnowledgeBaseSchema,
      // @ts-expect-error Vercel AI SDK type mismatch with internal tools
      execute: async ({ query }: { query: string }) => {
        const results = await hybridSearch(kbId, query, 5);
        return {
          results: results.map((r) => ({
            content: r.content,
            relevanceScore: r.score,
          })),
          resultCount: results.length,
        };
      },
    });
  }

  return { mcpTools, mcpCleanup };
}
