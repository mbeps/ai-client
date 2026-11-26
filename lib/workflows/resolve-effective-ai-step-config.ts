import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { Agent } from "@/types/agent/agent";
import type { AiStepNodeData } from "@/types/workflows/workflow";

/**
 * Resolved execution configuration for an `ai_step` node after applying
 * `Node override -> Linked Agent -> Workflow default` precedence.
 */
export interface EffectiveAiStepConfig {
  modelId: string | null;
  reasoningEffort: ReasoningEffort | undefined;
  knowledgeBaseIds: string[];
  skillMode: SkillMode;
  skillIds: string[];
  subagentIds: string[];
  toolIds: string[];
  mcpServerIds: string[];
  agentPersonaPrompt?: string;
}

interface ResolveEffectiveAiStepConfigArgs {
  nodeData: AiStepNodeData;
  linkedAgent?: Agent | null;
  workflowRow: {
    modelId?: string | null;
    reasoningEffort?: ReasoningEffort | null;
    knowledgeBaseIds?: string[];
    skillMode?: SkillMode;
    skillIds?: string[];
    subagentIds?: string[];
    tools?: string[];
  };
}

function resolveModelAndEffort(
  nodeData: AiStepNodeData,
  linkedAgent: Agent | null | undefined,
  workflowRow: ResolveEffectiveAiStepConfigArgs["workflowRow"],
): { modelId: string | null; reasoningEffort: ReasoningEffort | undefined } {
  if (nodeData.modelId) {
    return {
      modelId: nodeData.modelId,
      reasoningEffort: nodeData.reasoningEffort,
    };
  }
  if (linkedAgent?.modelId) {
    return {
      modelId: linkedAgent.modelId,
      reasoningEffort: linkedAgent.reasoningEffort ?? undefined,
    };
  }
  return {
    modelId: workflowRow.modelId ?? null,
    reasoningEffort: workflowRow.reasoningEffort ?? undefined,
  };
}

function resolveSkills(
  nodeData: AiStepNodeData,
  linkedAgent: Agent | null | undefined,
  workflowRow: ResolveEffectiveAiStepConfigArgs["workflowRow"],
): { skillMode: SkillMode; skillIds: string[] } {
  if (nodeData.skillMode && nodeData.skillMode !== "inherit") {
    return {
      skillMode: nodeData.skillMode,
      skillIds: nodeData.skillIds ?? [],
    };
  }
  if (linkedAgent) {
    return {
      skillMode: linkedAgent.skillMode,
      skillIds: linkedAgent.skillIds,
    };
  }
  return {
    skillMode: workflowRow.skillMode ?? "dynamic",
    skillIds: workflowRow.skillIds ?? [],
  };
}

function firstNonEmpty(
  ...candidates: Array<readonly string[] | undefined>
): string[] {
  for (const list of candidates) {
    if (list && list.length > 0) {
      return [...list];
    }
  }
  return [];
}

function extractMcpServerIdsFromTools(toolIds: readonly string[]): string[] {
  const serverIds = new Set<string>();
  for (const id of toolIds) {
    const [serverId, kind] = id.split(":");
    if (kind === "tool" && serverId && serverId !== "internal") {
      serverIds.add(serverId);
    }
  }
  return [...serverIds];
}

/**
 * Merges `ai_step` node overrides, an optional linked `Agent`, and workflow-level
 * defaults using strict `Node -> Agent -> Workflow` precedence.
 */
export function resolveEffectiveAiStepConfig({
  nodeData,
  linkedAgent,
  workflowRow,
}: ResolveEffectiveAiStepConfigArgs): EffectiveAiStepConfig {
  const { modelId, reasoningEffort } = resolveModelAndEffort(
    nodeData,
    linkedAgent,
    workflowRow,
  );
  const { skillMode, skillIds } = resolveSkills(
    nodeData,
    linkedAgent,
    workflowRow,
  );
  const toolIds = firstNonEmpty(
    nodeData.toolIds,
    linkedAgent?.tools,
    workflowRow.tools,
  );

  return {
    modelId,
    reasoningEffort,
    knowledgeBaseIds: firstNonEmpty(
      nodeData.knowledgeBaseIds,
      linkedAgent?.knowledgebaseIds,
      workflowRow.knowledgeBaseIds,
    ),
    skillMode,
    skillIds,
    subagentIds: firstNonEmpty(
      nodeData.subagentIds,
      linkedAgent?.subagentIds,
      workflowRow.subagentIds,
    ),
    toolIds,
    mcpServerIds:
      nodeData.mcpServerIds.length > 0
        ? [...nodeData.mcpServerIds]
        : extractMcpServerIdsFromTools(toolIds),
    agentPersonaPrompt: linkedAgent?.prompt || undefined,
  };
}
