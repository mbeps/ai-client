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
 * Loads and sanitises external MCP tools for the provided scoped servers.
 *
 * @param scopedServers - MCP server parameters
 * @param selectedTools - Optional allowed tools filter
 * @returns Loaded tools, source map, and cleanup callback
 * @author Maruf Bepary
 */
async function loadScopedMcpTools(
  scopedServers: McpServerParam[],
  selectedTools?: string[],
): Promise<{
  tools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  cleanup: () => Promise<void>;
}> {
  if (scopedServers.length === 0) {
    return { tools: {}, toolSourceMap: {}, cleanup: async () => {} };
  }

  try {
    const result = await getMcpTools(scopedServers, selectedTools);
    const filtered = filterSelectedMcpTools(result, selectedTools);
    const sanitised = sanitiseToolNames(filtered.tools, filtered.toolSourceMap);
    return {
      tools: sanitised.tools,
      toolSourceMap: sanitised.toolSourceMap,
      cleanup: result.cleanup,
    };
  } catch (error) {
    log.warn("Failed to load MCP tools: {error}", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { tools: {}, toolSourceMap: {}, cleanup: async () => {} };
  }
}

interface LegacyInternalToolOptions {
  isArtifactToolSelected?: boolean;
  activeKbId?: string | null;
  activeKbIds?: string[];
  kbIsReady?: boolean;
  userId?: string;
  selectedTools?: string[];
}

/**
 * Injects legacy internal tools (artifacts and knowledge base) into the tool registry.
 *
 * @param mcpTools - Tool dictionary to populate
 * @param toolSourceMap - Tool source map to update
 * @param options - Internal tool flags and context
 * @author Maruf Bepary
 */
function registerLegacyInternalTools(
  mcpTools: Record<string, any>,
  toolSourceMap: Record<string, string>,
  options: LegacyInternalToolOptions,
): void {
  if (options.isArtifactToolSelected) {
    Object.assign(mcpTools, registerArtifactTool());
    toolSourceMap.manage_artifact = "Internal";
  }

  const targetKbIds = resolveTargetKbIds(
    options.activeKbIds,
    options.activeKbId,
  );
  if (targetKbIds.length > 0 && options.kbIsReady && options.userId) {
    const kbTools = registerKnowledgebaseTool(
      targetKbIds,
      options.kbIsReady,
      options.userId,
      options.selectedTools,
    );
    if (kbTools.search_knowledge_base) {
      Object.assign(mcpTools, kbTools);
      toolSourceMap.search_knowledge_base = "System";
    }
  }
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
  const { tools, toolSourceMap, cleanup } = await loadScopedMcpTools(
    scopedServers,
    selectedTools,
  );

  registerLegacyInternalTools(tools, toolSourceMap, {
    isArtifactToolSelected,
    activeKbId,
    activeKbIds,
    kbIsReady,
    userId,
    selectedTools,
  });

  return { mcpTools: tools, toolSourceMap, mcpCleanup: cleanup };
}
