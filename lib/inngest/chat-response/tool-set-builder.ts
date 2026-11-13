import { env } from "@/config/env";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { registerArtifactTool } from "@/lib/chat/register-artifact-tool";
import { registerFileUrlTool } from "@/lib/chat/register-file-url-tool";
import { registerKnowledgebaseTool } from "@/lib/chat/register-knowledgebase-tool";
import { registerMemoryTool } from "@/lib/chat/register-memory-tool";
import { registerSkillAuthoringTools } from "@/lib/chat/register-skill-authoring-tools";
import { registerSkillTool } from "@/lib/chat/register-skill-tool";
import type {
  BuildOrchestratorToolSetParams,
  OrchestratorToolSetResult,
} from "@/lib/inngest/chat-response/chat-response-types";
import { createSubagentDispatchTool } from "@/lib/subagents/create-subagent-dispatch-tool";
import { registerScratchpadTools } from "@/lib/subagents/register-subagent-tools";

/**
 * Determines active target knowledge base IDs from context.
 * Normalizes both single `activeKbId` and multi-selection `activeKbIds` into an array.
 *
 * @param ctx - Context object containing active knowledge base IDs
 * @returns Array of target knowledge base UUIDs
 * @author Maruf Bepary
 */
function resolveTargetKbIds(ctx: {
  activeKbIds?: string[];
  activeKbId?: string | null;
}): string[] {
  if (ctx.activeKbIds && ctx.activeKbIds.length > 0) {
    return ctx.activeKbIds;
  }
  return ctx.activeKbId ? [ctx.activeKbId] : [];
}

/**
 * Checks whether a specific internal tool is permitted by selectedTools.
 * Returns true if no restriction filter was passed (`undefined`) or if explicitly included.
 *
 * @param toolId - Internal tool ID to check
 * @param selectedTools - Optional allowed tool ID whitelist
 * @returns Whether the tool is permitted for this execution
 * @author Maruf Bepary
 */
function isInternalToolAllowed(
  toolId: string,
  selectedTools?: string[],
): boolean {
  return selectedTools === undefined || selectedTools.includes(toolId);
}

/**
 * Determines whether subagent task delegation is enabled.
 * True when the explicit `subagentsEnabled` flag is set or `delegate_task` is selected.
 *
 * @param subagentsEnabled - Explicit subagent delegation flag from chat options
 * @param selectedTools - Whitelist of permitted tool IDs
 * @returns Whether subagent delegation is active
 * @author Maruf Bepary
 */
function isSubagentEnabled(
  subagentsEnabled?: boolean,
  selectedTools?: string[],
): boolean {
  return (
    subagentsEnabled === true ||
    Boolean(selectedTools?.includes(INTERNAL_TOOL_IDS.DELEGATE_TASK))
  );
}

/**
 * Builds scratchpad tools if subagent delegation is active.
 *
 * @param enabled - Whether scratchpad tools should be registered
 * @param chatId - Chat session identifier
 * @param messageId - Current assistant message identifier
 * @returns Registered scratchpad tools or empty object
 * @author Maruf Bepary
 */
function buildScratchpadTools(
  enabled: boolean,
  chatId: string,
  messageId: string,
): Record<string, any> {
  if (!enabled) return {};
  return registerScratchpadTools({
    chatId,
    messageId,
    workerRole: "orchestrator",
  });
}

/**
 * Builds subagent dispatch tools if delegation is enabled.
 * Configures the delegate_task tool with default and optional custom worker models.
 *
 * @param params - Tool set configuration including available tools and models
 * @returns Object with delegate_task tool if enabled, empty object otherwise
 * @author Maruf Bepary
 */
function buildSubagentDispatchTools(params: {
  isSubagentDelegationEnabled: boolean;
  orchestratorActiveTools: Record<string, any>;
  resolved: any;
  resolvedModelId: string;
  workerResolved: any;
  scratchpadContext?: { chatId: string; messageId: string };
  allowedSubagents?: BuildOrchestratorToolSetParams["ctx"]["linkedSubagents"];
}): Record<string, any> {
  if (!params.isSubagentDelegationEnabled) {
    return {};
  }
  const customWorkerModel = params.workerResolved
    ? params.workerResolved.sdkProvider.chat(params.workerResolved.modelId)
    : undefined;
  return {
    delegate_task: createSubagentDispatchTool({
      defaultModel: params.resolved.sdkProvider.chat(params.resolvedModelId),
      customWorkerModel,
      availableTools: params.orchestratorActiveTools,
      maxSteps: env.CHAT_MAX_STEPS,
      scratchpadContext: params.scratchpadContext,
      allowedSubagents: params.allowedSubagents,
    }),
  };
}

/**
 * Builds and registers all orchestrator and subagent dispatch tools.
 * Resolves knowledge base subagent configuration using the dedicated worker model
 * (falling back to orchestrator model) and attaches MCP, artifact, memory, and skill tools.
 *
 * @param params - Full orchestrator tool set builder configuration
 * @returns Configured tools and feature flags for orchestrator execution
 * @author Maruf Bepary
 */
export function buildOrchestratorToolSet(
  params: BuildOrchestratorToolSetParams,
): OrchestratorToolSetResult {
  const {
    userId,
    chatId,
    assistantMessageId,
    isToolCallingModel,
    mcpTools,
    selectedTools,
    ctx,
    fileAttachments,
    isMemoryEnabled,
    subagentsEnabled,
    resolved,
    resolvedModelId,
    workerResolved,
  } = params;

  if (!isToolCallingModel) {
    return {
      orchestratorActiveTools: {},
      subagentDispatchTools: {},
      allTools: undefined,
      hasAnyTools: false,
      hasKbTool: false,
      hasArtifactTool: false,
      artifactTools: {},
      isSubagentDelegationEnabled: false,
    };
  }

  const targetKbIds = resolveTargetKbIds(ctx);
  const kbSubagentModel = workerResolved
    ? workerResolved.sdkProvider.chat(workerResolved.modelId)
    : resolved.sdkProvider.chat(resolvedModelId);
  const kbSubagentContextWindow =
    workerResolved?.contextWindow ?? resolved.contextWindow;

  const kbTools = registerKnowledgebaseTool(
    targetKbIds,
    ctx.kbIsReady ?? false,
    userId,
    selectedTools,
    {
      model: kbSubagentModel,
      contextWindow: kbSubagentContextWindow,
    },
  );
  const hasKbTool = Object.keys(kbTools).length > 0;

  const isArtifactSelected = isInternalToolAllowed(
    INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    selectedTools,
  );
  const artifactTools = isArtifactSelected ? registerArtifactTool() : {};
  const hasArtifactTool = Object.keys(artifactTools).length > 0;

  const memoryTools = isMemoryEnabled
    ? registerMemoryTool(userId, selectedTools)
    : {};

  const skillTools =
    ctx.availableSkills.length > 0
      ? registerSkillTool(userId, {
          projectId: ctx.chatRow?.projectId,
          assistantId: ctx.chatRow?.agentId ?? ctx.chatRow?.assistantId,
        })
      : {};

  const skillAuthoringTools = isInternalToolAllowed(
    INTERNAL_TOOL_IDS.MANAGE_SKILL,
    selectedTools,
  )
    ? registerSkillAuthoringTools(userId)
    : {};

  const isSubagentDelegationEnabled = isSubagentEnabled(
    subagentsEnabled,
    selectedTools,
  );

  const scratchpadTools = buildScratchpadTools(
    isSubagentDelegationEnabled,
    chatId,
    assistantMessageId,
  );

  const fileUrlTools =
    fileAttachments.length > 0 ? registerFileUrlTool(fileAttachments) : {};

  const orchestratorActiveTools: Record<string, any> = Object.assign(
    {},
    mcpTools,
    artifactTools,
    memoryTools,
    kbTools,
    skillTools,
    skillAuthoringTools,
    fileUrlTools,
    scratchpadTools,
  );

  const subagentDispatchTools = buildSubagentDispatchTools({
    isSubagentDelegationEnabled,
    orchestratorActiveTools,
    resolved,
    resolvedModelId,
    workerResolved,
    scratchpadContext: {
      chatId,
      messageId: assistantMessageId,
    },
    allowedSubagents: ctx.linkedSubagents,
  });

  const allTools = Object.assign(
    {},
    orchestratorActiveTools,
    subagentDispatchTools,
  );
  const hasAnyTools = Object.keys(allTools).length > 0;

  return {
    orchestratorActiveTools,
    subagentDispatchTools,
    allTools: hasAnyTools ? allTools : undefined,
    hasAnyTools,
    hasKbTool,
    hasArtifactTool,
    artifactTools,
    isSubagentDelegationEnabled,
  };
}
