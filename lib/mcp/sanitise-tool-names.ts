import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "mcp", "tools", "sanitise"]);

const MAX_TOOL_NAME_LENGTH = 64;
const INVALID_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;

/**
 * Sanitises an individual tool name to comply with LLM provider requirements
 * (e.g. OpenAI ^[a-zA-Z0-9_-]{1,64}$).
 *
 * @param raw - Raw remote tool name
 * @returns Sanitised tool name of 1-64 characters
 */
export function sanitiseToolName(raw: string): string {
  if (!raw || typeof raw !== "string") {
    return "tool";
  }

  // Replace all invalid characters with underscores
  const cleaned = raw.replace(INVALID_CHARS_REGEX, "_");

  return cleaned.slice(0, MAX_TOOL_NAME_LENGTH);
}

/**
 * Sanitises a set of MCP tools and their accompanying source/server mapping records.
 * Resolves name collisions by appending numeric suffixes (_2, _3) while respecting the 64-char limit.
 *
 * @param tools - Record of tool names to tool definitions
 * @param toolSourceMap - Optional map of tool name to server name
 * @param toolServerIdMap - Optional map of tool name to server ID
 * @returns Object containing sanitised tools and updated mapping records
 */
export function sanitiseToolNames<T>(
  tools: Record<string, T>,
  toolSourceMap?: Record<string, string>,
  toolServerIdMap?: Record<string, string>,
): {
  tools: Record<string, T>;
  toolSourceMap: Record<string, string>;
  toolServerIdMap: Record<string, string>;
} {
  const resultTools: Record<string, T> = {};
  const resultSourceMap: Record<string, string> = {};
  const resultServerIdMap: Record<string, string> = {};

  const usedNames = new Set<string>();

  for (const [originalName, tool] of Object.entries(tools)) {
    const baseCleaned = sanitiseToolName(originalName);
    let finalName = baseCleaned;
    let counter = 2;

    while (usedNames.has(finalName)) {
      const suffix = `_${counter}`;
      const prefixLimit = Math.max(1, MAX_TOOL_NAME_LENGTH - suffix.length);
      finalName = `${baseCleaned.slice(0, prefixLimit)}${suffix}`;
      counter++;
    }

    usedNames.add(finalName);
    resultTools[finalName] = tool;

    if (toolSourceMap && originalName in toolSourceMap) {
      resultSourceMap[finalName] = toolSourceMap[originalName]!;
    }
    if (toolServerIdMap && originalName in toolServerIdMap) {
      resultServerIdMap[finalName] = toolServerIdMap[originalName]!;
    }

    if (finalName !== originalName) {
      log.info(
        "Sanitised MCP tool name '{originalName}' to '{finalName}' for provider compatibility",
        { originalName, finalName },
      );
    }
  }

  return {
    tools: resultTools,
    toolSourceMap: resultSourceMap,
    toolServerIdMap: resultServerIdMap,
  };
}
