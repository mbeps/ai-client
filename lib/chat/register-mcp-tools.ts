import { getLogger } from "@/lib/logger";
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";
import { sanitiseToolNames } from "@/lib/mcp/sanitise-tool-names";
import { registerArtifactTool } from "./register-artifact-tool";
import { registerKnowledgebaseTool } from "./register-knowledgebase-tool";

const log = getLogger(["app", "chat", "tools"]);

/**
 * MCP server parameter type for tool registration.
 * @author Maruf Bepary
 */
type McpServerParam = Parameters<typeof getMcpTools>[0][number];

/**
 * Registers external MCP tools and optionally delegates built-in tools
 * (manage_artifact, search_knowledge_base) for backward compatibility.
 * Filters MCP tools by selectedTools list if provided.
 * Handles failures gracefully, logging warnings but continuing with available tools.
 * Registers a cleanup function to disconnect MCP servers after streaming completes.
 *
 * @param scopedServers - MCP servers available for this chat
 * @param selectedTools - Optional list of tool IDs to include (e.g., "server:tool:name")
 * @param isArtifactToolSelected - Optional flag to register manage_artifact tool (backward compatibility)
 * @param activeKbId - Optional knowledge base ID (backward compatibility)
 * @param kbIsReady - Optional whether active knowledge base has finished indexing (backward compatibility)
 * @param userId - Optional authenticated user ID (backward compatibility)
 * @param activeKbIds - Optional array of active knowledge base IDs (backward compatibility)
 * @returns Object with mcpTools dict, toolSourceMap (tool -> server name), and cleanup function
 * @see {@link lib/chat/build-system-prompt.ts} for system prompt setup
 * @author Maruf Bepary
 */
export async function registerMcpTools(
  scopedServers: McpServerParam[],
  selectedTools?: string[],
  isArtifactToolSelected?: boolean,
  activeKbId?: string | null,
  kbIsReady?: boolean,
  userId?: string,
  activeKbIds?: string[],
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
          const serverId = result.toolServerIdMap?.[name];
          const serverName = result.toolSourceMap[name];
          const isSelected =
            (serverId && selectedTools.includes(`${serverId}:tool:${name}`)) ||
            (serverName &&
              selectedTools.includes(`${serverName}:tool:${name}`));
          if (isSelected) {
            filteredTools[name] = toolDef;
            toolSourceMap[name] = result.toolSourceMap[name];
          }
        }
        mcpTools = filteredTools;
      }

      // Sanitise remote MCP tool names to ensure LLM provider charset compliance (e.g. OpenAI ^[a-zA-Z0-9_-]{1,64}$)
      const sanitised = sanitiseToolNames(mcpTools, toolSourceMap);
      mcpTools = sanitised.tools;
      toolSourceMap = sanitised.toolSourceMap;

      mcpCleanup = result.cleanup;
    } catch (error) {
      log.warn("Failed to load MCP tools: {error}", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Delegation for backward compatibility:
  if (isArtifactToolSelected) {
    const artifactTools = registerArtifactTool();
    Object.assign(mcpTools, artifactTools);
    toolSourceMap.manage_artifact = "Internal";
  }

  const targetKbIds =
    activeKbIds && activeKbIds.length > 0
      ? activeKbIds
      : activeKbId
        ? [activeKbId]
        : [];

  if (targetKbIds.length > 0 && kbIsReady && userId) {
    const kbTools = registerKnowledgebaseTool(
      targetKbIds,
      kbIsReady,
      userId,
      selectedTools,
    );
    if (kbTools.search_knowledge_base) {
      Object.assign(mcpTools, kbTools);
      toolSourceMap.search_knowledge_base = "System";
    }
  }

  return { mcpTools, toolSourceMap, mcpCleanup };
}
