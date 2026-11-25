import { toolSearch } from "ai";
import { isInternalToolBlocked } from "@/config/tool-approval";
import { registerAppHelpTool } from "@/lib/app-tools/register-app-help-tool";
import { registerInspectWorkspaceTool } from "@/lib/app-tools/register-inspect-workspace-tool";
import { registerManageAgentTool } from "@/lib/app-tools/register-manage-agent-tool";
import { registerManageProjectTool } from "@/lib/app-tools/register-manage-project-tool";
import { registerManagePromptTool } from "@/lib/app-tools/register-manage-prompt-tool";
import { registerManageSkillTool } from "@/lib/app-tools/register-manage-skill-tool";
import { registerManageWorkflowTool } from "@/lib/app-tools/register-manage-workflow-tool";
import type { ToolPermissionMode } from "@/types/tool/approval";

/** Options for registering app self-knowledge and deferred workspace tools. */
export interface RegisterAppToolsOptions {
  internalToolOverrides?: Record<string, ToolPermissionMode | undefined>;
  preUnlockedToolNames?: ReadonlySet<string>;
  includeManageSkill?: boolean;
}

/**
 * Registers `app_help`, `search_app_tools`, and the 6 deferred workspace
 * tools (`inspect_workspace`, `manage_skill`, `manage_project`, `manage_agent`,
 * `manage_prompt`, `manage_workflow`), respecting user `"block"` overrides
 * and pre-unlocking tools during approval-resume turns.
 *
 * @param userId - Authenticated owner user ID
 * @param options - Overrides, pre-unlocked tool names, and skill gating flag
 * @returns Combined tool dictionary ready to merge into `orchestratorActiveTools`
 */
export function registerAppTools(
  userId: string,
  options?: RegisterAppToolsOptions,
): Record<string, any> {
  const overrides = options?.internalToolOverrides;
  const preUnlocked = options?.preUnlockedToolNames;
  const tools: Record<string, any> = {};

  if (!isInternalToolBlocked("app_help", overrides)) {
    Object.assign(tools, registerAppHelpTool());
  }

  const deferredCandidates: Array<
    [string, (deferLoading: boolean) => Record<string, any>]
  > = [
    [
      "inspect_workspace",
      (deferLoading) => registerInspectWorkspaceTool(userId, { deferLoading }),
    ],
    ...(options?.includeManageSkill !== false
      ? [
          [
            "manage_skill",
            (deferLoading: boolean) =>
              registerManageSkillTool(userId, { deferLoading }),
          ] as [string, (deferLoading: boolean) => Record<string, any>],
        ]
      : []),
    [
      "manage_project",
      (deferLoading) => registerManageProjectTool(userId, { deferLoading }),
    ],
    [
      "manage_agent",
      (deferLoading) => registerManageAgentTool(userId, { deferLoading }),
    ],
    [
      "manage_prompt",
      (deferLoading) => registerManagePromptTool(userId, { deferLoading }),
    ],
    [
      "manage_workflow",
      (deferLoading) => registerManageWorkflowTool(userId, { deferLoading }),
    ],
  ];

  let hasDeferredTools = false;
  for (const [name, register] of deferredCandidates) {
    if (isInternalToolBlocked(name, overrides)) continue;
    const deferLoading = !preUnlocked?.has(name);
    if (deferLoading) hasDeferredTools = true;
    Object.assign(tools, register(deferLoading));
  }

  if (
    hasDeferredTools &&
    !isInternalToolBlocked("search_app_tools", overrides)
  ) {
    tools.search_app_tools = toolSearch({ maxResults: 6 });
  }

  return tools;
}
