import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { Prompt } from "@/types/prompt/prompt";

/**
 * Represents a categorized group of prompt items.
 *
 * @author Maruf Bepary
 */
export interface PromptGroup {
  id: string;
  name: string;
  isInternal: boolean;
  items: MentionPromptItem[];
}

/**
 * Maps database prompts and discovered MCP prompts into unified MentionPromptItems.
 *
 * @param prompts - Custom user prompts from the database.
 * @param mcpPrompts - Discovered prompts from active MCP servers.
 * @returns Array of unified prompt items.
 * @author Maruf Bepary
 */
export function buildPromptItems(
  prompts: Prompt[] = [],
  mcpPrompts: DiscoveredPrompt[] = [],
): MentionPromptItem[] {
  const localItems: MentionPromptItem[] = prompts.map((p) => ({
    ...p,
    isMcp: false,
    isSkill: false,
  }));

  const mcpItems: MentionPromptItem[] = mcpPrompts.map((p) => ({
    ...p,
    id: `mcp:${p.serverId}:${p.name}`,
    title: p.name,
    shortcut: p.name,
    sourceServer: p.serverName,
    isMcp: true,
    isSkill: false,
  }));

  return [...localItems, ...mcpItems];
}

/**
 * Filters unified prompt items matching a search keyword across title, shortcut, content, description, or server.
 *
 * @param items - List of prompt items.
 * @param query - Raw search query string.
 * @returns Filtered prompt items.
 * @author Maruf Bepary
 */
export function filterPromptsByQuery(
  items: MentionPromptItem[],
  query: string,
): MentionPromptItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(q);
    const shortcutMatch = item.shortcut?.toLowerCase().includes(q) ?? false;
    const contentMatch =
      "content" in item && typeof item.content === "string"
        ? item.content.toLowerCase().includes(q)
        : false;
    const descMatch =
      "description" in item && typeof item.description === "string"
        ? item.description.toLowerCase().includes(q)
        : false;
    const serverMatch =
      "sourceServer" in item && typeof item.sourceServer === "string"
        ? item.sourceServer.toLowerCase().includes(q)
        : false;

    return (
      titleMatch || shortcutMatch || contentMatch || descMatch || serverMatch
    );
  });
}

/**
 * Groups prompt items into Internal Prompts and per-MCP-server categories.
 *
 * @param filteredItems - Already filtered prompt items.
 * @param mcpPrompts - Known MCP prompts to seed empty categories.
 * @param hasQuery - Whether a search query is active.
 * @param hasPrompts - Whether database prompts exist.
 * @returns Ordered array of PromptGroups.
 * @author Maruf Bepary
 */
export function groupPromptsByCategory(
  filteredItems: MentionPromptItem[],
  mcpPrompts: DiscoveredPrompt[] = [],
  hasQuery: boolean = false,
  hasPrompts: boolean = false,
): PromptGroup[] {
  const list: PromptGroup[] = [];

  // Internal group
  const internalItems = filteredItems.filter((item) => !item.isMcp);
  if (internalItems.length > 0 || (!hasQuery && hasPrompts)) {
    list.push({
      id: "internal",
      name: "Internal Prompts",
      isInternal: true,
      items: internalItems,
    });
  }

  // MCP groups
  const mcpServerOrder: string[] = [];
  const mcpServerMap = new Map<
    string,
    { name: string; items: MentionPromptItem[] }
  >();

  mcpPrompts.forEach((p) => {
    const serverId = p.serverId || p.serverName || "mcp";
    if (!mcpServerMap.has(serverId)) {
      mcpServerOrder.push(serverId);
      mcpServerMap.set(serverId, {
        name: p.serverName || "MCP Server",
        items: [],
      });
    }
  });

  filteredItems
    .filter((item) => item.isMcp)
    .forEach((item) => {
      const sId =
        ("serverId" in item && typeof item.serverId === "string"
          ? item.serverId
          : "") ||
        item.sourceServer ||
        "mcp";
      if (!mcpServerMap.has(sId)) {
        mcpServerOrder.push(sId);
        mcpServerMap.set(sId, {
          name: item.sourceServer || "MCP Server",
          items: [],
        });
      }
      mcpServerMap.get(sId)!.items.push(item);
    });

  mcpServerOrder.forEach((serverId) => {
    const data = mcpServerMap.get(serverId);
    if (data && (data.items.length > 0 || !hasQuery)) {
      list.push({
        id: serverId,
        name: data.name,
        isInternal: false,
        items: data.items,
      });
    }
  });

  return list;
}

/**
 * Computes the initially expanded accordion groups based on defaultExpanded and selectedPromptIds.
 *
 * @param defaultExpanded - Whether accordions should expand by default.
 * @param selectedPromptIds - Active selected prompt IDs.
 * @param mcpPrompts - Discovered MCP prompts.
 * @returns Set of accordion IDs to initially expand.
 * @author Maruf Bepary
 */
export function resolveInitialExpandedGroups(
  defaultExpanded: boolean,
  selectedPromptIds?: Set<string>,
  mcpPrompts: DiscoveredPrompt[] = [],
): Set<string> {
  const initial = new Set<string>();

  if (defaultExpanded) {
    initial.add("internal");
    mcpPrompts.forEach((p) => {
      initial.add(p.serverId || p.serverName || "mcp");
    });
  } else if (selectedPromptIds && selectedPromptIds.size > 0) {
    initial.add("internal");
    mcpPrompts.forEach((p) => {
      const sId = p.serverId || p.serverName || "mcp";
      if (selectedPromptIds.has(`mcp:${p.serverId}:${p.name}`)) {
        initial.add(sId);
      }
    });
  }

  return initial;
}
