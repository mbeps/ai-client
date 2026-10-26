import { registerArtifactTool } from "@/lib/chat/register-artifact-tool";
import { registerKnowledgebaseTool } from "@/lib/chat/register-knowledgebase-tool";
import { getLogger } from "@/lib/logger";
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";
import { sanitiseToolNames } from "@/lib/mcp/sanitise-tool-names";

const log = getLogger(["app", "chat", "tools"]);

/**
 * MCP server parameter type for tool registration.
 * @author Maruf Bepary
 */
type McpServerParam = Parameters<typeof getMcpTools>[0][number];

/**
 * Filters MCP tools based on selectedTools list or includes all by default.
 *
 * @param result - Target result
 * @param selectedTools - Target selected tools
 * @returns The resolved result
 * @author Maruf Bepary
 */
function filterSelectedMcpTools(
  result: Awaited<ReturnType<typeof getMcpTools>>,
  selectedTools?: string[],
): {
  tools: Record<string, any>;
  toolSourceMap: Record<string, string>;
} {
  if (selectedTools === undefined) {
    return {
      tools: result.tools,
      toolSourceMap: { ...result.toolSourceMap },
    };
  }

  if (selectedTools.length === 0) {
    return { tools: {}, toolSourceMap: {} };
  }

  const tools: Record<string, any> = {};
  const toolSourceMap: Record<string, string> = {};

  for (const [name, toolDef] of Object.entries(result.tools)) {
    const serverId = result.toolServerIdMap?.[name];
    const serverName = result.toolSourceMap[name];
    const isSelected =
      (serverId && selectedTools.includes(`${serverId}:tool:${name}`)) ||
      (serverName && selectedTools.includes(`${serverName}:tool:${name}`));

    if (isSelected) {
      tools[name] = toolDef;
      toolSourceMap[name] = result.toolSourceMap[name];
    }
  }

  return { tools, toolSourceMap };
}

/**
 * Resolves active knowledgebase IDs from either array or singular ID.
 *
 * @param activeKbIds - Target active kb ids
 * @param activeKbId - Target active kb id
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveTargetKbIds(
  activeKbIds?: string[],
  activeKbId?: string | null,
): string[] {
  if (activeKbIds && activeKbIds.length > 0) {
    return activeKbIds;
  }
  return activeKbId ? [activeKbId] : [];
}

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
      const filtered = filterSelectedMcpTools(result, selectedTools);

      // Sanitise remote MCP tool names to ensure LLM provider charset compliance (e.g. OpenAI ^[a-zA-Z0-9_-]{1,64}$)
      const sanitised = sanitiseToolNames(
        filtered.tools,
        filtered.toolSourceMap,
      );
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

  const targetKbIds = resolveTargetKbIds(activeKbIds, activeKbId);

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
