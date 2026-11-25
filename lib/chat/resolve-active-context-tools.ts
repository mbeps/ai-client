import { isInternalToolBlocked } from "@/config/tool-approval";
import { DEFERRED_APP_TOOL_NAMES, INTERNAL_TOOL_IDS } from "@/config/tools";
import type { ToolPermissionMode } from "@/types/tool/approval";

const DEFERRED_SET = new Set<string>(DEFERRED_APP_TOOL_NAMES);

const INTERNAL_ID_TO_RUNTIME_NAME: Record<string, string | undefined> = {
  [INTERNAL_TOOL_IDS.MANAGE_ARTIFACT]: "manage_artifact",
  [INTERNAL_TOOL_IDS.MANAGE_MEMORY]: "save_memory",
  [INTERNAL_TOOL_IDS.DELEGATE_TASK]: "delegate_task",
  [INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE]: "search_knowledge_base",
};

/**
 * Resolves the step-0 active tool names for the Context Meter, excluding
 * deferred workspace tools (`0` upfront tokens) and blocked internal tools,
 * and adding `app_help` / `search_app_tools` when active.
 */
export function resolveActiveContextToolNames(params: {
  selectedTools: Iterable<string>;
  supportsTools: boolean;
  internalToolOverrides?: Record<string, ToolPermissionMode | undefined>;
}): string[] {
  if (!params.supportsTools) {
    return [];
  }

  const overrides = params.internalToolOverrides;
  const selectedList = Array.from(params.selectedTools);
  const hasManageSkillSelected = selectedList.includes(
    INTERNAL_TOOL_IDS.MANAGE_SKILL,
  );

  const active: string[] = [];
  for (const name of selectedList) {
    if (name === INTERNAL_TOOL_IDS.MANAGE_SKILL || DEFERRED_SET.has(name)) {
      continue;
    }
    const runtimeName = INTERNAL_ID_TO_RUNTIME_NAME[name];
    if (runtimeName && isInternalToolBlocked(runtimeName, overrides)) {
      continue;
    }
    active.push(name);
  }

  if (!isInternalToolBlocked("app_help", overrides)) {
    active.push("app_help");
  }

  const hasActiveDeferredTool = DEFERRED_APP_TOOL_NAMES.some((name) => {
    if (name === "manage_skill" && !hasManageSkillSelected) {
      return false;
    }
    return !isInternalToolBlocked(name, overrides);
  });

  if (
    hasActiveDeferredTool &&
    !isInternalToolBlocked("search_app_tools", overrides)
  ) {
    active.push("search_app_tools");
  }

  return active;
}
