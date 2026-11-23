import { INTERNAL_TOOL_CATALOGUE } from "@/config/tools";
import type {
  ApprovalMode,
  ToolApprovalMap,
  ToolPermissionMode,
} from "@/types/tool/approval";

const SCRATCHPAD_AND_ALIAS_TOOLS = [
  "scratchpad_write",
  "scratchpad_read",
  "scratchpad_list",
  "manage_memory",
] as const;

/**
 * Internal tool names that execute without prompting by default.
 * Derived from `INTERNAL_TOOL_CATALOGUE` plus turn scratchpad tools and aliases.
 */
export const DEFAULT_AUTO_APPROVED_INTERNAL_TOOLS: ReadonlySet<string> =
  new Set([
    ...INTERNAL_TOOL_CATALOGUE.filter(
      (tool) => tool.defaultApproval === "auto",
    ).map((tool) => tool.name),
    ...SCRATCHPAD_AND_ALIAS_TOOLS,
  ]);

/**
 * Complete set of recognised internal tool names, including gated skill
 * mutation tools, scratchpad tools, and legacy aliases.
 */
export const INTERNAL_TOOL_NAMES: ReadonlySet<string> = new Set([
  ...INTERNAL_TOOL_CATALOGUE.map((tool) => tool.name),
  ...SCRATCHPAD_AND_ALIAS_TOOLS,
]);

/**
 * Options for resolving per-tool execution approval policy.
 */
export interface BuildToolApprovalOptions {
  /** Per-user overrides for internal tools loaded from `user_settings`. */
  internalToolOverrides?: Record<string, ToolPermissionMode | undefined>;
  /** Per-MCP-server allowlists keyed by `serverId`. */
  autoApprovedMcpToolsByServer?: Record<string, readonly string[] | undefined>;
  /** Per-MCP-server blocklists keyed by `serverId`. */
  blockedMcpToolsByServer?: Record<string, readonly string[] | undefined>;
  /** Map from runtime tool name to MCP `serverId`. */
  toolServerIdMap?: Record<string, string | undefined>;
  /** Map from sanitised/suffixed runtime tool name to raw MCP tool name. */
  toolRawNameMap?: Record<string, string | undefined>;
}

/**
 * Safely parses `user_settings.internal_tool_approvals` JSON into a validated
 * map of tool names to `"ask" | "auto" | "block"` modes, ignoring malformed or invalid entries.
 *
 * @param raw - Raw JSON string from `user_settings.internal_tool_approvals`
 * @returns Sanitized map of internal tool permission overrides
 */
export function parseInternalToolApprovals(
  raw: string | null | undefined,
): Record<string, ToolPermissionMode> {
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  const result: Record<string, ToolPermissionMode> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value === "ask" || value === "auto" || value === "block") {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Resolves the effective permission mode for a single internal tool, checking
 * user overrides first and falling back to the catalogue default (fail-closed
 * to `"ask"` for unrecognised names).
 *
 * @param toolName - Runtime tool name
 * @param overrides - Optional per-user internal tool permission overrides
 * @returns Effective `"ask"`, `"auto"`, or `"block"` mode
 */
export function resolveInternalToolApproval(
  toolName: string,
  overrides?: Record<string, ToolPermissionMode | undefined>,
): ToolPermissionMode {
  const override = overrides?.[toolName];
  if (override === "ask" || override === "auto" || override === "block") {
    return override;
  }
  return DEFAULT_AUTO_APPROVED_INTERNAL_TOOLS.has(toolName) ? "auto" : "ask";
}

/**
 * Checks whether an internal tool (or its legacy alias) is explicitly blocked.
 *
 * @param toolName - Runtime internal tool name
 * @param overrides - Optional per-user internal tool permission overrides
 * @returns True if the tool is blocked
 */
export function isInternalToolBlocked(
  toolName: string,
  overrides?: Record<string, ToolPermissionMode | undefined>,
): boolean {
  if (resolveInternalToolApproval(toolName, overrides) === "block") {
    return true;
  }
  return (
    toolName === "manage_memory" &&
    resolveInternalToolApproval("save_memory", overrides) === "block"
  );
}

/**
 * Checks whether a list of tool patterns matches a given runtime/raw MCP tool name.
 */
function matchesMcpToolList(
  list: readonly string[] | undefined,
  rawName: string,
  runtimeName: string,
): boolean {
  return Boolean(
    list &&
      (list.includes(rawName) ||
        list.includes(runtimeName) ||
        list.includes("*")),
  );
}

/**
 * Builds the AI SDK `toolApproval` map for every registered runtime tool name.
 * Fails closed to `"user-approval"` for blocked tools (even in `"auto"` mode)
 * and for any tool in `"ask"` mode without an explicit auto-approval rule.
 *
 * @param toolNames - Runtime tool keys from `Object.keys(allTools)`
 * @param mode - Per-chat approval mode (`"ask"` or `"auto"`)
 * @param options - Internal overrides and per-server MCP allowlists/blocklists
 * @returns Exhaustive `ToolApprovalMap` keyed by runtime tool name
 */
export function buildToolApproval(
  toolNames: readonly string[],
  mode: ApprovalMode,
  options?: BuildToolApprovalOptions,
): ToolApprovalMap {
  const approvalMap: ToolApprovalMap = {};

  for (const name of toolNames) {
    if (INTERNAL_TOOL_NAMES.has(name) && !options?.toolServerIdMap?.[name]) {
      const resolved = resolveInternalToolApproval(
        name,
        options?.internalToolOverrides,
      );
      if (resolved === "block") {
        approvalMap[name] = "user-approval";
        continue;
      }
      if (mode === "auto") {
        approvalMap[name] = "not-applicable";
        continue;
      }
      approvalMap[name] =
        resolved === "auto" ? "not-applicable" : "user-approval";
      continue;
    }

    const serverId = options?.toolServerIdMap?.[name];
    const rawName = options?.toolRawNameMap?.[name] ?? name;
    const isBlocked =
      Boolean(serverId) &&
      matchesMcpToolList(
        options?.blockedMcpToolsByServer?.[serverId!],
        rawName,
        name,
      );
    if (isBlocked) {
      approvalMap[name] = "user-approval";
      continue;
    }

    if (mode === "auto") {
      approvalMap[name] = "not-applicable";
      continue;
    }

    if (!serverId) {
      approvalMap[name] = "user-approval";
      continue;
    }

    const isAllowed = matchesMcpToolList(
      options?.autoApprovedMcpToolsByServer?.[serverId],
      rawName,
      name,
    );

    approvalMap[name] = isAllowed ? "not-applicable" : "user-approval";
  }

  return approvalMap;
}
