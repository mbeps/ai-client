import { tool } from "ai";
import { PROMPTS } from "@/constants/prompts";
import { logger } from "@/lib/logger";
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";
import { hybridSearch } from "@/lib/rag/hybrid-search";
import {
  manageArtifactSchema,
  searchKnowledgeBaseSchema,
} from "@/schemas/chat/chat";

/**
 * MCP server parameter type for tool registration.
 * @author Maruf Bepary
 */
type McpServerParam = Parameters<typeof getMcpTools>[0][number];

/**
 * Registers MCP tools and built-in tools (manage_artifact, search_knowledgebase) for a chat request.
 * Filters MCP tools by selectedTools list if provided.
 * Handles failures gracefully, logging warnings but continuing with available tools.
 * Registers a cleanup function to disconnect MCP servers after streaming completes.
 *
 * @param scopedServers - MCP servers available for this chat
 * @param selectedTools - Optional list of tool IDs to include (e.g., "server:tool:name")
 * @param isArtifactToolSelected - Whether to register the manage_artifact tool
 * @param activeKbId - Knowledge base ID if available (for search_knowledgebase tool)
 * @param kbIsReady - Whether the active knowledge base has finished indexing
 * @param userId - Authenticated user ID
 * @returns Object with mcpTools dict, toolSourceMap (tool -> server name), and cleanup function
 * @see {@link lib/chat/build-system-prompt.ts} for system prompt setup
 * @author Maruf Bepary
 */
export async function registerMcpTools(
  scopedServers: McpServerParam[],
  selectedTools: string[] | undefined,
  isArtifactToolSelected: boolean,
  activeKbId: string | null,
  kbIsReady: boolean,
  userId: string,
): Promise<{
  mcpTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  mcpCleanup: () => Promise<void>;
}> {
  let mcpTools: Record<string, any> = {};
  let toolSourceMap: Record<string, string> = {};
  let mcpCleanup = async () => {};

  if (scopedServers.length > 0) {
    try {
      const result = await getMcpTools(scopedServers);

      if (selectedTools === undefined) {
        // Fallback for missing selection: include all tools from eligible servers
        mcpTools = result.tools;
        toolSourceMap = { ...result.toolSourceMap };
      } else if (selectedTools.length === 0) {
        // Explicitly empty selection: no MCP tools
        mcpTools = {};
        toolSourceMap = {};
      } else {
        // Selective filtering
        const filteredTools: Record<string, any> = {};
        for (const [name, toolDef] of Object.entries(result.tools)) {
          // Full-id match keeps selection server-scoped when duplicate tool
          // names exist across servers. getMcpTools merges by bare name
          // (first server wins), so toolSourceMap identifies the owner.
          const isSelected = selectedTools.includes(
            `${result.toolSourceMap[name]}:tool:${name}`,
          );
          if (isSelected) {
            filteredTools[name] = toolDef;
            toolSourceMap[name] = result.toolSourceMap[name];
          }
        }
        mcpTools = filteredTools;
      }

      mcpCleanup = result.cleanup;
    } catch (error) {
      console.warn("[MCP] Failed to load tools:", error);
    }
  }

  if (isArtifactToolSelected) {
    toolSourceMap.manage_artifact = "Internal";
    mcpTools.manage_artifact = tool({
      description: PROMPTS.TOOLS.MANAGE_ARTIFACT.DESCRIPTION,
      inputSchema: manageArtifactSchema,
      execute: async (args) => {
        try {
          // For spreadsheets the AI may pass `sheets` as a top-level arg instead of
          // embedding the JSON in `content`. Serialize it so the viewer can parse it.
          // ponytail: `text` is not in the advertised schema but some models still send it.
          let content = args.content || (args as { text?: string }).text || "";

          // If sheets are provided directly, use them to build the content
          if (args.sheets && Array.isArray(args.sheets)) {
            content = JSON.stringify({ sheets: args.sheets });
          } else if (args.sheets && typeof args.sheets === "string") {
            // Some models might stringify the sheets array themselves
            try {
              const parsedSheets = JSON.parse(args.sheets);
              if (Array.isArray(parsedSheets)) {
                content = JSON.stringify({ sheets: parsedSheets });
              } else if (parsedSheets.sheets) {
                content = JSON.stringify(parsedSheets);
              }
            } catch {
              // Fallback to raw string if it's not valid JSON
              content = args.sheets;
            }
          }

          const normalizedArgs = {
            id: crypto.randomUUID(),
            // Schema validates type at parse time, so args.type is always valid here.
            type: args.type,
            title: args.title || PROMPTS.TOOLS.MANAGE_ARTIFACT.DEFAULT_TITLE,
            content,
          };

          return {
            success: true,
            message: PROMPTS.TOOLS.MANAGE_ARTIFACT.SUCCESS_MESSAGE,
            artifact: normalizedArgs,
          };
        } catch (error) {
          logger.error("[Artifact] Failed to process tool call:", error);
          return {
            success: false,
            message:
              error instanceof Error ? error.message : "Unknown error occurred",
          };
        }
      },
    });
  }

  if (activeKbId && kbIsReady) {
    const kbId = activeKbId;
    toolSourceMap.search_knowledge_base = "System";
    mcpTools.search_knowledge_base = tool({
      description: PROMPTS.TOOLS.SEARCH_KNOWLEDGE_BASE.DESCRIPTION,
      inputSchema: searchKnowledgeBaseSchema,
      execute: async (args) => {
        const { query } = args;
        const normalizedQuery = (query || "").trim();

        if (!normalizedQuery) {
          return {
            success: false,
            error:
              "Missing mandatory 'query' parameter. Search requires a specific keyword or phrase.",
          };
        }

        const results = await hybridSearch(kbId, normalizedQuery, userId, 5);

        if (results.length === 0) {
          return {
            success: true,
            results: [],
            resultCount: 0,
            message: `No results found for '${normalizedQuery}'. Try using different keywords or broader search terms.`,
          };
        }

        return {
          results: results.map((r) => ({
            content: r.content,
            relevanceScore: r.score,
            documentId: r.documentId,
            documentName: r.documentName,
          })),
          resultCount: results.length,
        };
      },
    });
  }

  return { mcpTools, toolSourceMap, mcpCleanup };
}
