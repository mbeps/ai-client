import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { registerKnowledgebaseTool } from "@/lib/chat/register-knowledgebase-tool";
import { registerSkillAuthoringTools } from "@/lib/chat/register-skill-authoring-tools";
import { registerSkillTool } from "@/lib/chat/register-skill-tool";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import { checkVisionSupport } from "@/lib/chat/vision-guard";
import { ToolsNotSupportedError } from "@/lib/error/tools-not-supported-error";
import { VisionNotSupportedError } from "@/lib/error/vision-not-supported-error";
import {
  createSubagentDispatchTool,
  filterToolsForAgent,
} from "@/lib/subagents/create-subagent-dispatch-tool";
import type { AttachmentRow } from "@/lib/workflows/build-file-context";
import { buildFileContext } from "@/lib/workflows/build-file-context";
import { isSpreadsheetMutationTool } from "@/lib/workflows/is-spreadsheet-mutation-tool";
import type { Agent } from "@/types/agent/agent";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import type { SkillSummary } from "@/types/skill/skill";
import type {
  AiStepNodeData,
  ArtifactCanvasType,
  WorkflowCanvasConfig,
} from "@/types/workflows/workflow";

/**
 * Resolves effective canvas artifact policy for an AI step node.
 */
export function resolveStepCanvasPolicy(
  nodeCanvasMode: AiStepNodeData["canvasMode"],
  canvasConfig: WorkflowCanvasConfig,
): {
  enabled: boolean;
  enforcedType: ArtifactCanvasType | null;
  allowedTypes: ArtifactCanvasType[];
} {
  if (nodeCanvasMode === "disabled") {
    return { enabled: false, enforcedType: null, allowedTypes: [] };
  }
  if (
    nodeCanvasMode === "markdown" ||
    nodeCanvasMode === "spreadsheet" ||
    nodeCanvasMode === "html" ||
    nodeCanvasMode === "mermaid"
  ) {
    return {
      enabled: true,
      enforcedType: nodeCanvasMode,
      allowedTypes: [nodeCanvasMode],
    };
  }
  if (!canvasConfig.enabled && nodeCanvasMode !== "any") {
    return { enabled: false, enforcedType: null, allowedTypes: [] };
  }
  const allowed =
    canvasConfig.allowedTypes.length > 0
      ? canvasConfig.allowedTypes
      : ([
          "markdown",
          "spreadsheet",
          "html",
          "mermaid",
        ] as ArtifactCanvasType[]);
  const enforcedType =
    nodeCanvasMode !== "any" &&
    canvasConfig.defaultType &&
    canvasConfig.defaultType !== "any"
      ? canvasConfig.defaultType
      : null;

  return {
    enabled: true,
    enforcedType,
    allowedTypes: allowed,
  };
}

/**
 * Validates that the resolved model supports active tools and image attachments.
 */
export function assertStepModelCapabilities(
  resolvedProvider: ResolvedProvider,
  filteredTools: Record<string, any>,
  currentAttachmentRows: AttachmentRow[],
): void {
  const capTools = resolvedProvider.modelRow?.capTools ?? true;
  if (!capTools && Object.keys(filteredTools).length > 0) {
    throw new ToolsNotSupportedError();
  }

  const capVision = resolvedProvider.modelRow?.capVision ?? true;
  const hasImageAttachments = currentAttachmentRows.some(
    (a) => a.mimeType?.startsWith("image/") || (a as any).type === "image",
  );
  if (!hasImageAttachments) return;

  const stepMessages = [
    {
      role: "user",
      attachments: currentAttachmentRows.map((a) => ({
        id: a.id,
        name: a.name,
        mimeType: a.mimeType,
        type: a.mimeType?.startsWith("image/") ? "image" : (a as any).type,
      })),
    },
  ];
  if (!checkVisionSupport(stepMessages as any, !!capVision)) {
    throw new VisionNotSupportedError();
  }
}

function resolveStepServerNames(
  step: AiStepNodeData,
  allServers: any[],
): Set<string> {
  const stepServers =
    step.mcpServerIds.length > 0
      ? allServers.filter((s) => step.mcpServerIds.includes(s.id))
      : allServers;
  return new Set(stepServers.map((s) => s.name));
}

function isToolAllowed(
  toolName: string,
  source: string,
  stepServerNames: Set<string>,
  allowedToolIds: Set<string>,
): boolean {
  if (toolName === "search_knowledge_base" && source === "System") {
    return true;
  }
  const isInternal = source === "Internal" || source === "System";
  const fromAllowedServer = isInternal || stepServerNames.has(source);
  if (!fromAllowedServer) return false;
  if (allowedToolIds.size === 0) return true;

  return Array.from(allowedToolIds).some((id) => {
    const [, type, name] = id.split(":");
    return type === "tool" && name === toolName;
  });
}

/** Parameters for `filterStepTools`. */
export interface FilterStepToolsParams {
  step: AiStepNodeData;
  workflowRow: {
    tools: string[] | null;
    requiresFileUpload: boolean;
    canvasConfig: WorkflowCanvasConfig;
  };
  allServers: any[];
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  userId: string;
  skillCatalog: SkillSummary[];
  activeWorkbookFilePath: string | null;
  currentAttachmentRows: AttachmentRow[];
  dryRun?: boolean;
  linkedSubagents?: Agent[];
  resolvedProvider?: ResolvedProvider;
}

/**
 * Filters tools available to a workflow AI step node, respecting canvas policy,
 * dry-run protections, skills, subagents, and active staged workbooks.
 */
export function filterStepTools(params: FilterStepToolsParams): {
  filteredTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  stepServerNames: Set<string>;
} {
  const {
    step,
    workflowRow,
    allServers,
    runMcpTools,
    runToolSourceMap,
    userId,
    skillCatalog,
    activeWorkbookFilePath,
    currentAttachmentRows,
    dryRun,
    linkedSubagents,
    resolvedProvider,
  } = params;

  const stepServerNames = resolveStepServerNames(step, allServers);
  const canvasPolicy = resolveStepCanvasPolicy(
    step.canvasMode,
    workflowRow.canvasConfig,
  );
  const allowedToolIds = new Set([
    ...(workflowRow.tools || []),
    ...(step.toolIds || []),
  ]);

  const filteredEntries = Object.entries(runMcpTools).filter(([toolName]) => {
    if (dryRun && isSpreadsheetMutationTool(toolName)) {
      return false;
    }
    if (toolName === "manage_artifact" && !canvasPolicy.enabled) {
      return false;
    }
    return isToolAllowed(
      toolName,
      runToolSourceMap[toolName],
      stepServerNames,
      allowedToolIds,
    );
  });

  const filteredTools = Object.fromEntries(filteredEntries);
  if (skillCatalog.length > 0) {
    Object.assign(filteredTools, registerSkillTool(userId));
  }
  if (allowedToolIds.has(INTERNAL_TOOL_IDS.MANAGE_SKILL)) {
    Object.assign(filteredTools, registerSkillAuthoringTools(userId));
  }

  const hasStepSubagents = Boolean(
    step.subagentIds && step.subagentIds.length > 0,
  );
  if (
    (allowedToolIds.has(INTERNAL_TOOL_IDS.DELEGATE_TASK) || hasStepSubagents) &&
    linkedSubagents &&
    linkedSubagents.length > 0 &&
    resolvedProvider
  ) {
    filteredTools.delegate_task = createSubagentDispatchTool({
      defaultModel: resolvedProvider.sdkProvider.chat(resolvedProvider.modelId),
      availableTools: { ...filteredTools },
      allowedSubagents: linkedSubagents,
      resolveModelById: async (modelId: string) => {
        const targetResolved = await resolveProvider(userId, modelId).catch(
          () => null,
        );
        return targetResolved
          ? targetResolved.sdkProvider.chat(targetResolved.modelId)
          : undefined;
      },
      buildIsolatedTools: (agent) =>
        filterToolsForAgent(
          Object.fromEntries(
            Object.entries({ ...runMcpTools, ...filteredTools }).filter(
              ([toolName]) =>
                toolName !== "search_knowledge_base" &&
                !(dryRun && isSpreadsheetMutationTool(toolName)),
            ),
          ),
          agent.tools,
          agent.knowledgebaseIds,
          { toolSourceMap: runToolSourceMap },
        ),
      buildKnowledgebaseTools: (kbIds) =>
        registerKnowledgebaseTool(kbIds, true, userId, undefined, {
          model: resolvedProvider.sdkProvider.chat(resolvedProvider.modelId),
          contextWindow: resolvedProvider.modelRow?.contextWindow ?? undefined,
        }),
    });
  }

  const toolSourceMap = Object.fromEntries(
    filteredEntries.map(([toolName]) => [toolName, runToolSourceMap[toolName]]),
  ) as Record<string, string>;

  if (
    workflowRow.requiresFileUpload &&
    activeWorkbookFilePath &&
    currentAttachmentRows.length <= 1 &&
    "upload_file" in filteredTools
  ) {
    delete filteredTools.upload_file;
    delete toolSourceMap.upload_file;
  }

  return { filteredTools, toolSourceMap, stepServerNames };
}

/**
 * Builds the file context prompt block for a workflow node from active staged workbooks or attachments.
 */
export async function resolveStepFileContext(
  activeWorkbookFilePath: string | null,
  currentAttachmentRows: AttachmentRow[],
  userId: string,
): Promise<string> {
  if (activeWorkbookFilePath) {
    return `A staged file is already loaded in the MCP session for this run. Reuse this exact file path for subsequent tool operations: ${activeWorkbookFilePath}. Do not call upload_file again unless explicitly instructed to switch source files.`;
  }
  if (currentAttachmentRows.length > 0) {
    const { fileContext } = await buildFileContext(
      currentAttachmentRows.map((r) => r.id),
      userId,
    );
    return fileContext;
  }
  return "";
}
