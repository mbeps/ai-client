import { INTERNAL_TOOL_CATALOGUE } from "@/config/tools";
import type { ApprovalMode, ToolApprovalMap } from "@/types/tool/approval";

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
  internalToolOverrides?: Record<string, ApprovalMode | undefined>;
  /** Per-MCP-server allowlists keyed by `serverId`. */
  autoApprovedMcpToolsByServer?: Record<string, readonly string[] | undefined>;
  /** Map from runtime tool name to MCP `serverId`. */
  toolServerIdMap?: Record<string, string | undefined>;
  /** Map from sanitised/suffixed runtime tool name to raw MCP tool name. */
  toolRawNameMap?: Record<string, string | undefined>;
}

/**
 * Safely parses `user_settings.internal_tool_approvals` JSON into a validated
 * map of tool names to `"ask" | "auto"` modes, ignoring malformed or invalid entries.
 *
 * @param raw - Raw JSON string from `user_settings.internal_tool_approvals`
 * @returns Sanitized map of internal tool approval overrides
 */
export function parseInternalToolApprovals(
  raw: string | null | undefined,
): Record<string, ApprovalMode> {
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

  const result: Record<string, ApprovalMode> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value === "ask" || value === "auto") {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Resolves the effective approval mode for a single internal tool, checking
 * user overrides first and falling back to the catalogue default (fail-closed
 * to `"ask"` for unrecognised names).
 *
 * @param toolName - Runtime tool name
 * @param overrides - Optional per-user internal tool approval overrides
 * @returns Effective `"ask"` or `"auto"` mode
 */
export function resolveInternalToolApproval(
  toolName: string,
  overrides?: Record<string, ApprovalMode | undefined>,
): ApprovalMode {
  const override = overrides?.[toolName];
  if (override === "ask" || override === "auto") {
    return override;
  }
  return DEFAULT_AUTO_APPROVED_INTERNAL_TOOLS.has(toolName) ? "auto" : "ask";
}

/**
 * Builds the AI SDK `toolApproval` map for every registered runtime tool name.
 * Fails closed to `"user-approval"` in `"ask"` mode for any tool without an
 * explicit auto-approval rule.
 *
 * @param toolNames - Runtime tool keys from `Object.keys(allTools)`
 * @param mode - Per-chat approval mode (`"ask"` or `"auto"`)
 * @param options - Internal overrides and per-server MCP allowlists
 * @returns Exhaustive `ToolApprovalMap` keyed by runtime tool name
 */
export function buildToolApproval(
  toolNames: readonly string[],
  mode: ApprovalMode,
  options?: BuildToolApprovalOptions,
): ToolApprovalMap {
  const approvalMap: ToolApprovalMap = {};

  for (const name of toolNames) {
    if (mode === "auto") {
      approvalMap[name] = "not-applicable";
      continue;
    }

    if (INTERNAL_TOOL_NAMES.has(name)) {
      const resolved = resolveInternalToolApproval(
        name,
        options?.internalToolOverrides,
      );
      approvalMap[name] =
        resolved === "auto" ? "not-applicable" : "user-approval";
      continue;
    }

    const serverId = options?.toolServerIdMap?.[name];
    if (!serverId) {
      approvalMap[name] = "user-approval";
      continue;
    }

    const rawName = options?.toolRawNameMap?.[name] ?? name;
    const allowed = options?.autoApprovedMcpToolsByServer?.[serverId];
    const isAllowed = Boolean(
      allowed &&
        (allowed.includes(rawName) ||
          allowed.includes(name) ||
          allowed.includes("*")),
    );

    approvalMap[name] = isAllowed ? "not-applicable" : "user-approval";
  }

  return approvalMap;
}
