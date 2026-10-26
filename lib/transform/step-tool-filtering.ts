import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { registerSkillAuthoringTools } from "@/lib/chat/register-skill-authoring-tools";
import { registerSkillTool } from "@/lib/chat/register-skill-tool";
import { checkVisionSupport } from "@/lib/chat/vision-guard";
import { ToolsNotSupportedError } from "@/lib/error/tools-not-supported-error";
import { VisionNotSupportedError } from "@/lib/error/vision-not-supported-error";
import type { AttachmentRow } from "@/lib/transform/build-file-context";
import { buildFileContext } from "@/lib/transform/build-file-context";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import type { SkillSummary } from "@/types/skill/skill";
import type { TransformStep } from "@/types/transform/transform-step";

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

export function resolveStepServerNames(
  step: TransformStep,
  allServers: any[],
): Set<string> {
  const stepServers =
    step.mcpServerIds.length > 0
      ? allServers.filter((s) => step.mcpServerIds.includes(s.id))
      : allServers;
  return new Set(stepServers.map((s) => s.name));
}

export function isToolAllowed(
  toolName: string,
  source: string,
  stepServerNames: Set<string>,
  allowedToolIds: Set<string>,
): boolean {
  const isInternal = source === "Internal" || source === "System";
  const fromAllowedServer = isInternal || stepServerNames.has(source);

  if (!fromAllowedServer) return false;
  if (allowedToolIds.size === 0) return true;

  return Array.from(allowedToolIds).some((id) => {
    const [, type, name] = id.split(":");
    return type === "tool" && name === toolName;
  });
}

export function pruneUploadFileToolIfLoaded(
  filteredTools: Record<string, any>,
  toolSourceMap: Record<string, string>,
  requiresFileUpload: boolean,
  activeWorkbookFilePath: string | null,
  attachmentCount: number,
): void {
  const isSingleWorkbookFlow = attachmentCount <= 1;
  if (
    requiresFileUpload &&
    activeWorkbookFilePath &&
    isSingleWorkbookFlow &&
    "upload_file" in filteredTools
  ) {
    delete filteredTools.upload_file;
    delete toolSourceMap.upload_file;
  }
}

export interface FilterStepToolsParams {
  step: TransformStep;
  agentRow: {
    tools: string[] | null;
    requiresFileUpload: boolean;
  };
  allServers: any[];
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  userId: string;
  skillCatalog: SkillSummary[];
  activeWorkbookFilePath: string | null;
  currentAttachmentRows: AttachmentRow[];
}

export function filterStepTools(params: FilterStepToolsParams): {
  filteredTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  stepServerNames: Set<string>;
} {
  const {
    step,
    agentRow,
    allServers,
    runMcpTools,
    runToolSourceMap,
    userId,
    skillCatalog,
    activeWorkbookFilePath,
    currentAttachmentRows,
  } = params;

  const stepServerNames = resolveStepServerNames(step, allServers);

  const allowedToolIds = new Set([
    ...(agentRow.tools || []),
    ...(step.toolIds || []),
  ]);

  const filteredEntries = Object.entries(runMcpTools).filter(([toolName]) =>
    isToolAllowed(
      toolName,
      runToolSourceMap[toolName],
      stepServerNames,
      allowedToolIds,
    ),
  );

  const filteredTools = Object.fromEntries(filteredEntries);
  if (skillCatalog.length > 0) {
    Object.assign(filteredTools, registerSkillTool(userId));
  }

  const allowSkillAuthoring =
    allowedToolIds.size === 0 ||
    allowedToolIds.has(INTERNAL_TOOL_IDS.MANAGE_SKILL);
  if (allowSkillAuthoring) {
    Object.assign(filteredTools, registerSkillAuthoringTools(userId));
  }

  const toolSourceMap = Object.fromEntries(
    filteredEntries.map(([toolName]) => [toolName, runToolSourceMap[toolName]]),
  ) as Record<string, string>;

  pruneUploadFileToolIfLoaded(
    filteredTools,
    toolSourceMap,
    agentRow.requiresFileUpload,
    activeWorkbookFilePath,
    currentAttachmentRows.length,
  );

  return { filteredTools, toolSourceMap, stepServerNames };
}

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
