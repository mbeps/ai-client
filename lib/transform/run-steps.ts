import { generateText, isStepCount } from "ai";
import { eq } from "drizzle-orm";
import * as xlsx from "xlsx";
import { env } from "@/config/env";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schema";
import { registerSkillAuthoringTools } from "@/lib/chat/register-skill-authoring-tools";
import { registerSkillTool } from "@/lib/chat/register-skill-tool";
import { checkVisionSupport } from "@/lib/chat/vision-guard";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";
import {
  InvalidArtifactFormatError,
  RATE_LIMIT_ERROR_CODE,
  ToolsNotSupportedError,
  VisionNotSupportedError,
} from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import {
  formatActiveSkill,
  formatSkillCatalog,
} from "@/lib/skills/build-skill-prompt";
import type { AttachmentRow } from "@/lib/transform/build-file-context";
import { buildFileContext } from "@/lib/transform/build-file-context";
import { extractArtifactFromToolPayload } from "@/lib/transform/extract-artifact-from-tool-payload";
import { extractDownloadFilePayload } from "@/lib/transform/extract-download-file-payload";
import { extractUploadedFilePath } from "@/lib/transform/extract-uploaded-file-path";
import { isSpreadsheetMutationTool } from "@/lib/transform/is-spreadsheet-mutation-tool";
import { persistTransformArtifact } from "@/lib/transform/persist-artifact";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import type { SkillSummary } from "@/types/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";
import type { TransformStep } from "@/types/transform/transform-step";

const log = getLogger(["app", "transform", "steps"]);

/**
 * Configuration for running a sequence of transform agent steps.
 * @author Maruf Bepary
 */
interface RunTransformStepsOptions {
  steps: TransformStep[];
  startFromStep: number;
  runRow: { id: string; outputAttachmentIds?: string[] | null };
  agentRow: {
    id: string;
    name: string;
    description: string | null;
    globalContext: string | null;
    requiresFileUpload: boolean;
    tools: string[] | null;
    modelId: string | null;
  };
  userId: string;
  allServers: any[];
  resolvedProvider: ResolvedProvider;
  kbContext: string;
  availableSkills?: SkillSummary[];
  selectedSkills?: SkillRow[];
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  initialAttachmentRows: AttachmentRow[];
  emit: (data: any) => void;
}

/**
 * Parameters for preparing tool and prompt context for a transform step.
 * @author Maruf Bepary
 */
interface PrepareStepExecutionParams {
  step: TransformStep;
  agentRow: RunTransformStepsOptions["agentRow"];
  allServers: any[];
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  userId: string;
  skillCatalog: SkillSummary[];
  preloadedSkills: SkillRow[];
  kbContext: string;
  activeWorkbookFilePath: string | null;
  currentAttachmentRows: AttachmentRow[];
}

/**
 * Resolved tools, tool source map, server names, and system prompt for a step.
 * @author Maruf Bepary
 */
interface StepExecutionPreparation {
  filteredTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  stepServerNames: Set<string>;
  systemPrompt: string;
}

/**
 * Parameters for executing a single step model turn.
 * @author Maruf Bepary
 */
interface ExecuteStepModelTurnParams {
  resolvedProvider: ResolvedProvider;
  filteredTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  systemPrompt: string;
  currentAttachmentRows: AttachmentRow[];
  activeWorkbookFilePath: string | null;
  runId: string;
  stepIndex: number;
  userId: string;
  emit: (data: any) => void;
}

/**
 * Result of executing a single step model turn.
 * @author Maruf Bepary
 */
interface StepModelTurnResult {
  stepSummary: string;
  stepArtifact: Record<string, unknown> | null;
  activeWorkbookFilePath: string | null;
  stepHasSpreadsheetMutations: boolean;
}

/**
 * Parameters for persisting artifacts and handling download fallbacks after a step.
 * @author Maruf Bepary
 */
interface HandleStepArtifactOutputParams {
  step: TransformStep;
  stepIndex: number;
  userId: string;
  runId: string;
  stepArtifact: Record<string, unknown> | null;
  stepHasSpreadsheetMutations: boolean;
  activeWorkbookFilePath: string | null;
  currentOutputAttachmentIds: string[];
  currentAttachmentRows: AttachmentRow[];
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  stepServerNames: Set<string>;
  emit: (data: any) => void;
}

/**
 * Result of artifact persistence and output attachment management.
 * @author Maruf Bepary
 */
interface HandleStepArtifactOutputResult {
  success: boolean;
  stepArtifact: Record<string, unknown> | null;
  stepOutputAttachmentId?: string;
  currentOutputAttachmentIds: string[];
  currentAttachmentRows: AttachmentRow[];
  activeWorkbookFilePath: string | null;
}

/**
 * Validates model capabilities against requested tools and image attachments.
 * @param resolvedProvider - Active provider and model row metadata
 * @param filteredTools - Filtered tool definitions for this step
 * @param currentAttachmentRows - Attachments loaded in the current run state
 * @throws {ToolsNotSupportedError} When tools are required but model lacks tool calling
 * @throws {VisionNotSupportedError} When images are attached but model lacks vision
 * @author Maruf Bepary
 */
function assertStepModelCapabilities(
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

/**
 * Resolves allowed MCP server names for the current step.
 */
function resolveStepServerNames(
  step: TransformStep,
  allServers: any[],
): Set<string> {
  const stepServers =
    step.mcpServerIds.length > 0
      ? allServers.filter((s) => step.mcpServerIds.includes(s.id))
      : allServers;
  return new Set(stepServers.map((s) => s.name));
}

interface FilterStepToolsParams {
  step: TransformStep;
  agentRow: RunTransformStepsOptions["agentRow"];
  allServers: any[];
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  userId: string;
  skillCatalog: SkillSummary[];
  activeWorkbookFilePath: string | null;
  currentAttachmentRows: AttachmentRow[];
}

/**
 * Checks whether a tool is permitted by allowed IDs and server origins.
 */
function isToolAllowed(
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

/**
 * Removes upload_file MCP tool when single-workbook flow already has staged file.
 */
function pruneUploadFileToolIfLoaded(
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

/**
 * Filters MCP tools by step allowed IDs and attaches internal skill tools.
 */
function filterStepTools(params: FilterStepToolsParams): {
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

/**
 * Resolves file context from active workbook path or current attachment rows.
 */
async function resolveStepFileContext(
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

interface BuildStepSystemPromptParams {
  step: TransformStep;
  agentRow: RunTransformStepsOptions["agentRow"];
  filteredTools: Record<string, any>;
  skillCatalog: SkillSummary[];
  preloadedSkills: SkillRow[];
  kbContext: string;
  fileContext: string;
}

const MANAGE_ARTIFACT_SYSTEM_INSTRUCTIONS =
  "- Canvas & Artifact Tool (manage_artifact): The canvas preview tool is enabled. Use manage_artifact to present interactive content on the side canvas:\n" +
  "  - 'markdown': Use for text reports, summaries, code, emails, or structured documents.\n" +
  "  - 'spreadsheet': Use for tabular data. Pass { sheets: [{ name: 'SheetName', data: [[...]] }] }.\n" +
  "  - 'html': Use for interactive designs, UI mockups, or standalone HTML snippets.\n" +
  "  - 'mermaid': Use for diagrams, workflows, and charts.\n" +
  "Whenever you create or update major output content for a step, call manage_artifact so the user can inspect it in the side canvas.";

/**
 * Checks whether manage_artifact tool should be advertised in the system prompt.
 */
function checkManageArtifactEnabled(
  filteredTools: Record<string, any>,
  agentTools: string[] | null,
  stepTools: string[] | null,
): boolean {
  if ("manage_artifact" in filteredTools) return true;
  if (agentTools?.includes(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT)) return true;
  return Boolean(stepTools?.includes(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT));
}

/**
 * Constructs system prompt for step execution.
 */
function buildStepSystemPrompt(params: BuildStepSystemPromptParams): string {
  const {
    step,
    agentRow,
    filteredTools,
    skillCatalog,
    preloadedSkills,
    kbContext,
    fileContext,
  } = params;

  const hasManageArtifact = checkManageArtifactEnabled(
    filteredTools,
    agentRow.tools,
    step.toolIds,
  );

  const sections: Array<string | null | undefined> = [
    agentRow.globalContext ? `Context:\n${agentRow.globalContext}` : null,
    kbContext ? `Additional Knowledge Context:\n${kbContext}` : null,
    ...preloadedSkills.map((s) => formatActiveSkill(s)),
    skillCatalog.length > 0 ? formatSkillCatalog(skillCatalog) : null,
    "You are a helpful AI assistant performing a task.",
    `Instructions for this step:\n${step.prompt}`,
    "Use only the provided MCP tools. After completing the task, briefly summarise what you did.",
    hasManageArtifact ? MANAGE_ARTIFACT_SYSTEM_INSTRUCTIONS : null,
    fileContext || null,
  ];

  return sections.filter(Boolean).join("\n\n");
}

/**
 * Filters MCP tools, assembles skill authoring tools, and constructs the step system prompt.
 * @param params - Configuration including step definition, servers, tools, and attachments
 * @returns Filtered tools map, tool sources, server names, and compiled system prompt
 * @author Maruf Bepary
 */
async function prepareStepExecution(
  params: PrepareStepExecutionParams,
): Promise<StepExecutionPreparation> {
  const { filteredTools, toolSourceMap, stepServerNames } =
    filterStepTools(params);

  const fileContext = await resolveStepFileContext(
    params.activeWorkbookFilePath,
    params.currentAttachmentRows,
    params.userId,
  );

  const systemPrompt = buildStepSystemPrompt({
    step: params.step,
    agentRow: params.agentRow,
    filteredTools,
    skillCatalog: params.skillCatalog,
    preloadedSkills: params.preloadedSkills,
    kbContext: params.kbContext,
    fileContext,
  });

  return {
    filteredTools,
    toolSourceMap,
    stepServerNames,
    systemPrompt,
  };
}

/**
 * Evaluates a single tool result, emits tool-result event, and extracts mutations/artifacts.
 * @author Maruf Bepary
 */
function handleSingleToolResult(
  tr: any,
  toolSourceMap: Record<string, string>,
  emit: (data: any) => void,
  runId: string,
  stepIndex: number,
  userId: string,
): {
  isMutation: boolean;
  uploadedWorkbookPath: string | null;
  artifact: Record<string, unknown> | null;
} {
  const serverName = toolSourceMap[tr.toolName];
  const payload = (tr as any).result ?? (tr as any).output;
  const isMutation = isSpreadsheetMutationTool(tr.toolName);
  let uploadedWorkbookPath: string | null = null;
  let artifact: Record<string, unknown> | null = null;

  const extractedPath =
    extractUploadedFilePath(payload) ??
    ((tr as any).args ? extractUploadedFilePath((tr as any).args) : null);

  if (extractedPath) {
    uploadedWorkbookPath = extractedPath;
    log.info(
      "Active file_path captured (runId: {runId}, stepIndex: {stepIndex}, tool: {toolName})",
      {
        runId,
        stepIndex,
        activeWorkbookFilePath: uploadedWorkbookPath,
        toolName: tr.toolName,
        userId,
      },
    );
  }

  if (tr.toolName === "manage_artifact") {
    artifact = extractArtifactFromToolPayload(payload);
    if (!artifact) {
      log.warn(
        "manage_artifact result had no extractable artifact (runId: {runId}, stepIndex: {stepIndex})",
        {
          runId,
          stepIndex,
          payloadType: typeof payload,
          userId,
        },
      );
    }
  }

  const formattedResult =
    typeof payload === "object" && payload !== null
      ? JSON.stringify(payload, null, 2)
      : payload;

  emit({
    type: "tool-result",
    toolCallId: tr.toolCallId,
    toolName: tr.toolName,
    result: formattedResult,
    serverName,
  });

  return { isMutation, uploadedWorkbookPath, artifact };
}

/**
 * Emits tool-call events for step execution.
 */
function emitStepToolCalls(
  toolCalls: any[],
  toolSourceMap: Record<string, string>,
  emit: (data: any) => void,
): void {
  for (const tc of toolCalls) {
    const serverName = toolSourceMap[tc.toolName];
    emit({
      type: "tool-call",
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: (tc as any).args || (tc as any).input,
      serverName,
    });
  }
}

/**
 * Processes tool calls and results emitted across AI SDK execution steps.
 * @param steps - Step records returned by AI SDK generateText
 * @param toolSourceMap - Tool name to MCP server name map
 * @param emit - Event emitter callback
 * @param runId - Active run ID for logging
 * @param stepIndex - Current step index for logging
 * @param userId - Active user ID for logging
 * @param initialWorkbookFilePath - Workbook path before processing
 * @returns Mutations flag, updated workbook path, and extracted artifact
 * @author Maruf Bepary
 */
function processStepExecutionTurn(
  steps: any[],
  toolSourceMap: Record<string, string>,
  emit: (data: any) => void,
  runId: string,
  stepIndex: number,
  userId: string,
  initialWorkbookFilePath: string | null,
): {
  stepHasSpreadsheetMutations: boolean;
  activeWorkbookFilePath: string | null;
  stepArtifact: Record<string, unknown> | null;
} {
  let stepHasSpreadsheetMutations = false;
  let currentActiveWorkbookFilePath = initialWorkbookFilePath;
  let stepArtifact: Record<string, unknown> | null = null;

  for (const stepInfo of steps) {
    emitStepToolCalls(stepInfo.toolCalls ?? [], toolSourceMap, emit);

    for (const tr of stepInfo.toolResults ?? []) {
      const { isMutation, uploadedWorkbookPath, artifact } =
        handleSingleToolResult(
          tr,
          toolSourceMap,
          emit,
          runId,
          stepIndex,
          userId,
        );
      if (isMutation) stepHasSpreadsheetMutations = true;
      if (uploadedWorkbookPath) {
        currentActiveWorkbookFilePath = uploadedWorkbookPath;
      }
      if (artifact) stepArtifact = artifact;
    }
  }

  return {
    stepHasSpreadsheetMutations,
    activeWorkbookFilePath: currentActiveWorkbookFilePath,
    stepArtifact,
  };
}

/**
 * Invokes the model turn with tool calls, processes tool execution results, and updates step state.
 * @param params - Provider, tools, prompt, attachments, and event emitter
 * @returns Step summary, extracted artifact, workbook file path, and mutation flag
 * @throws {ToolsNotSupportedError} When provider model lacks tool call capability
 * @throws {VisionNotSupportedError} When provider model lacks vision capability for image attachments
 * @author Maruf Bepary
 */
async function executeStepModelTurn({
  resolvedProvider,
  filteredTools,
  toolSourceMap,
  systemPrompt,
  currentAttachmentRows,
  activeWorkbookFilePath,
  runId,
  stepIndex,
  userId,
  emit,
}: ExecuteStepModelTurnParams): Promise<StepModelTurnResult> {
  assertStepModelCapabilities(
    resolvedProvider,
    filteredTools,
    currentAttachmentRows,
  );

  const result = await generateText({
    model: resolvedProvider.sdkProvider.chat(resolvedProvider.modelId),
    instructions: systemPrompt,
    messages: [{ role: "user", content: "Please execute the task." }],
    tools: filteredTools,
    stopWhen: isStepCount(env.CHAT_MAX_STEPS),
    maxRetries: 1,
  });

  const turn = processStepExecutionTurn(
    result.steps ?? [],
    toolSourceMap,
    emit,
    runId,
    stepIndex,
    userId,
    activeWorkbookFilePath,
  );

  const stepSummary = result.text || "Step completed.";
  return {
    stepSummary,
    stepArtifact: turn.stepArtifact,
    activeWorkbookFilePath: turn.activeWorkbookFilePath,
    stepHasSpreadsheetMutations: turn.stepHasSpreadsheetMutations,
  };
}

/**
 * Handles errors arising during step execution, updating run status and emitting failure events.
 * @param stepErr - Error thrown during step execution
 * @param stepName - Name of the step that failed
 * @param runId - ID of the transform run
 * @param emit - Event emitter callback
 * @author Maruf Bepary
 */
async function handleStepExecutionError(
  stepErr: unknown,
  stepName: string,
  runId: string,
  emit: (data: any) => void,
): Promise<void> {
  let msg = stepErr instanceof Error ? stepErr.message : "Step failed";
  let code = "ERROR";

  if (stepErr instanceof ToolsNotSupportedError) {
    code = "TOOLS_NOT_SUPPORTED";
  } else if (stepErr instanceof VisionNotSupportedError) {
    code = "VISION_NOT_SUPPORTED";
  } else if (isRateLimitError(stepErr)) {
    msg = normalizeRateLimitMessage(stepErr);
    code = RATE_LIMIT_ERROR_CODE;
  }

  await db
    .update(transformRun)
    .set({ status: "failed", errorMessage: msg })
    .where(eq(transformRun.id, runId));

  emit({
    type: "error",
    message: `Step "${stepName}" failed: ${msg}`,
    code,
  });
}

/**
 * Persists an explicit step artifact to S3 and database attachments.
 * @param artifact - Extracted artifact payload
 * @param stepIndex - Index of current step
 * @param userId - Owner user ID
 * @param runId - Associated transform run ID
 * @param stepName - Name of current step
 * @param emit - Event emitter callback
 * @author Maruf Bepary
 */
async function persistExplicitStepArtifact(
  artifact: Record<string, unknown>,
  stepIndex: number,
  userId: string,
  runId: string,
  stepName: string,
  emit: (data: any) => void,
) {
  try {
    const persisted = await persistTransformArtifact(
      { kind: "artifact", artifact, stepIndex },
      userId,
      runId,
    );
    return { success: true as const, persisted };
  } catch (err) {
    if (err instanceof InvalidArtifactFormatError) {
      const msg = `Step "${stepName}" produced invalid spreadsheet artifact: ${err.message}`;
      await db
        .update(transformRun)
        .set({ status: "failed", errorMessage: msg })
        .where(eq(transformRun.id, runId));

      emit({
        type: "error",
        message: msg,
        code: err.code,
      });
      return { success: false as const, error: err };
    }
    throw err;
  }
}

/**
 * Builds spreadsheet artifact representation from downloaded workbook buffer.
 */
function buildWorkbookFallbackArtifact(
  fileContent: string,
  stepIndex: number,
  stepName: string,
  attachmentName: string,
  runId: string,
): Record<string, unknown> | null {
  try {
    const buf = Buffer.from(fileContent, "base64");
    const wb = xlsx.read(buf, { type: "buffer" });
    const sheets = wb.SheetNames.map((name) => {
      const rawData = xlsx.utils.sheet_to_json(wb.Sheets[name], {
        header: 1,
      }) as any[][];
      return { name, data: rawData.slice(0, 500) };
    });
    return {
      id: `step-${stepIndex}-wb`,
      type: "spreadsheet",
      title: `${stepName} - ${attachmentName}`,
      content: JSON.stringify({ sheets }),
      messageId: `step-${stepIndex}`,
    };
  } catch (parseErr) {
    log.warn(
      "Failed to build spreadsheet artifact from downloaded workbook (runId: {runId}, stepIndex: {stepIndex}): {error}",
      {
        runId,
        stepIndex,
        error: (parseErr as Error).message,
      },
    );
    return null;
  }
}

/**
 * Resolves the download tool name available for the current step server.
 */
function resolveStepDownloadToolName(
  runToolSourceMap: Record<string, string>,
  stepServerNames: Set<string>,
  runMcpTools: Record<string, any>,
): string | null {
  const preferred = [
    "download_file",
    "download",
    "get_file",
    "export_file",
    "read_file",
    "get_file_content",
    "fetch_file",
  ];

  for (const name of preferred) {
    const src = runToolSourceMap[name];
    if (
      src &&
      stepServerNames.has(src) &&
      typeof runMcpTools[name]?.execute === "function"
    ) {
      return name;
    }
  }

  for (const [name, tool] of Object.entries(runMcpTools)) {
    const src = runToolSourceMap[name];
    if (
      src &&
      stepServerNames.has(src) &&
      /download|export|get_file/i.test(name) &&
      typeof (tool as any)?.execute === "function"
    ) {
      return name;
    }
  }

  return null;
}

/**
 * Downloads mutated workbook or generated file via MCP tool when model omitted manage_artifact.
 * @author Maruf Bepary
 */
async function executeWorkbookDownloadFallback(
  currentWorkbookPath: string,
  stepIndex: number,
  stepName: string,
  userId: string,
  runId: string,
  defaultFilename: string,
  runMcpTools: Record<string, any>,
  runToolSourceMap: Record<string, string>,
  stepServerNames: Set<string>,
) {
  const downloadToolName = resolveStepDownloadToolName(
    runToolSourceMap,
    stepServerNames,
    runMcpTools,
  );
  if (!downloadToolName) {
    return null;
  }

  const downloadTool = runMcpTools[downloadToolName] as {
    execute: (args: Record<string, string>) => Promise<unknown>;
  };

  try {
    const downloaded = await downloadTool.execute({
      file_path: currentWorkbookPath,
      path: currentWorkbookPath,
    });
    const downloadPayload = extractDownloadFilePayload(downloaded);
    if (!downloadPayload) return null;

    const persisted = await persistTransformArtifact(
      {
        kind: "download",
        fileContent: downloadPayload.fileContent,
        filename: downloadPayload.filename || defaultFilename,
        stepIndex,
      },
      userId,
      runId,
    );

    if (!persisted) return null;

    const fallbackArtifact = buildWorkbookFallbackArtifact(
      downloadPayload.fileContent,
      stepIndex,
      stepName,
      persisted.attachmentRow.name,
      runId,
    );

    log.info(
      "Persisted step output from download_file fallback (runId: {runId}, stepIndex: {stepIndex})",
      { runId, stepIndex, userId },
    );

    return { persisted, fallbackArtifact };
  } catch (downloadErr) {
    log.warn(
      "download_file fallback persistence failed (runId: {runId}, stepIndex: {stepIndex})",
      {
        error:
          downloadErr instanceof Error
            ? downloadErr.message
            : String(downloadErr),
        runId,
        stepIndex,
        userId,
      },
    );
    return null;
  }
}

/**
 * Attempts to persist explicit step artifact if valid artifact structure is provided.
 */
async function tryPersistExplicitArtifact(
  artifact: Record<string, unknown> | null,
  stepIndex: number,
  userId: string,
  runId: string,
  stepName: string,
  emit: (data: any) => void,
) {
  const hasValidArtifact =
    artifact !== null &&
    typeof (artifact as any).type === "string" &&
    typeof (artifact as any).content === "string";

  if (!artifact || !hasValidArtifact) {
    return { success: true as const, persisted: null };
  }

  return persistExplicitStepArtifact(
    artifact,
    stepIndex,
    userId,
    runId,
    stepName,
    emit,
  );
}

/**
 * Attempts download fallback for mutated workbook.
 */
async function tryDownloadFallback(
  currentWorkbookPath: string | null,
  stepIndex: number,
  stepName: string,
  userId: string,
  runId: string,
  defaultFilename: string,
  runMcpTools: Record<string, any>,
  runToolSourceMap: Record<string, string>,
  stepServerNames: Set<string>,
) {
  if (!currentWorkbookPath) {
    return null;
  }

  return executeWorkbookDownloadFallback(
    currentWorkbookPath,
    stepIndex,
    stepName,
    userId,
    runId,
    defaultFilename,
    runMcpTools,
    runToolSourceMap,
    stepServerNames,
  );
}

/**
 * Updates output attachment IDs, current rows, and output attachment ID after persistence.
 */
function applyPersistedOutput(
  persisted: { attachmentRow: AttachmentRow; outputAttachmentIds: string[] },
  currentOutputIds: string[],
): {
  currentOutputIds: string[];
  currentRows: AttachmentRow[];
  stepOutputAttachmentId: string;
} {
  return {
    currentOutputIds: Array.from(
      new Set([...currentOutputIds, ...persisted.outputAttachmentIds]),
    ),
    currentRows: [persisted.attachmentRow],
    stepOutputAttachmentId: persisted.attachmentRow.id,
  };
}

interface ApplyDownloadFallbackParams {
  shouldTry: boolean;
  currentWorkbookPath: string | null;
  stepIndex: number;
  stepName: string;
  userId: string;
  runId: string;
  defaultFilename: string;
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  stepServerNames: Set<string>;
  currentOutputIds: string[];
  artifact: Record<string, unknown> | null;
}

/**
 * Executes fallback download when mutations occurred without explicit manage_artifact persistence.
 */
async function applyDownloadFallbackIfMutated(
  params: ApplyDownloadFallbackParams,
): Promise<{
  currentOutputIds: string[];
  currentRows: AttachmentRow[];
  stepOutputAttachmentId: string;
  artifact: Record<string, unknown> | null;
} | null> {
  if (!params.shouldTry) {
    return null;
  }

  const fallback = await tryDownloadFallback(
    params.currentWorkbookPath,
    params.stepIndex,
    params.stepName,
    params.userId,
    params.runId,
    params.defaultFilename,
    params.runMcpTools,
    params.runToolSourceMap,
    params.stepServerNames,
  );

  if (!fallback) return null;

  const applied = applyPersistedOutput(
    fallback.persisted,
    params.currentOutputIds,
  );

  return {
    ...applied,
    artifact:
      !params.artifact && fallback.fallbackArtifact
        ? fallback.fallbackArtifact
        : params.artifact,
  };
}

/**
 * Marks run as failed and emits error when mutated workbook data cannot be persisted.
 */
async function failOnUnpersistedMutations(
  stepName: string,
  runId: string,
  emit: (data: any) => void,
): Promise<void> {
  const errorMessage = `Step "${stepName}" changed workbook data, but no spreadsheet artifact output was persisted. Refusing to complete with stale output.`;

  await db
    .update(transformRun)
    .set({ status: "failed", errorMessage })
    .where(eq(transformRun.id, runId));

  emit({ type: "error", message: errorMessage });
}

/**
 * Persists artifacts produced during a step, triggers fallback file downloads if mutations occurred,
 * and enforces the fail-safe guard against unpersisted workbook mutations.
 * @param params - Artifact, mutations flag, active file path, and persistence context
 * @returns Result with updated output attachments, rows, and active workbook path
 * @author Maruf Bepary
 */
async function handleStepArtifactOutput(
  params: HandleStepArtifactOutputParams,
): Promise<HandleStepArtifactOutputResult> {
  const {
    step,
    stepIndex,
    userId,
    runId,
    stepArtifact,
    stepHasSpreadsheetMutations,
    activeWorkbookFilePath,
    currentOutputAttachmentIds,
    currentAttachmentRows,
    runMcpTools,
    runToolSourceMap,
    stepServerNames,
    emit,
  } = params;

  let currentOutputIds = [...currentOutputAttachmentIds];
  let currentRows = [...currentAttachmentRows];
  let currentWorkbookPath = activeWorkbookFilePath;
  let artifact = stepArtifact;
  let stepOutputAttachmentId: string | undefined;
  let stepPersistedSpreadsheetOutput = false;

  const persistResult = await tryPersistExplicitArtifact(
    artifact,
    stepIndex,
    userId,
    runId,
    step.name,
    emit,
  );

  if (!persistResult.success) {
    return {
      success: false,
      stepArtifact: artifact,
      currentOutputAttachmentIds: currentOutputIds,
      currentAttachmentRows: currentRows,
      activeWorkbookFilePath: currentWorkbookPath,
    };
  }

  if (persistResult.persisted) {
    const applied = applyPersistedOutput(
      persistResult.persisted,
      currentOutputIds,
    );
    currentOutputIds = applied.currentOutputIds;
    currentRows = applied.currentRows;
    stepOutputAttachmentId = applied.stepOutputAttachmentId;
    stepPersistedSpreadsheetOutput = true;
    currentWorkbookPath = null;
  }

  const fallbackResult = await applyDownloadFallbackIfMutated({
    shouldTry: stepHasSpreadsheetMutations && !stepPersistedSpreadsheetOutput,
    currentWorkbookPath,
    stepIndex,
    stepName: step.name,
    userId,
    runId,
    defaultFilename:
      currentRows[0]?.name || `step-${stepIndex + 1}-output.xlsx`,
    runMcpTools,
    runToolSourceMap,
    stepServerNames,
    currentOutputIds,
    artifact,
  });

  if (fallbackResult) {
    currentOutputIds = fallbackResult.currentOutputIds;
    currentRows = fallbackResult.currentRows;
    stepOutputAttachmentId = fallbackResult.stepOutputAttachmentId;
    artifact = fallbackResult.artifact;
    stepPersistedSpreadsheetOutput = true;
  }

  if (stepHasSpreadsheetMutations && !stepPersistedSpreadsheetOutput) {
    await failOnUnpersistedMutations(step.name, runId, emit);
    return {
      success: false,
      stepArtifact: artifact,
      currentOutputAttachmentIds: currentOutputIds,
      currentAttachmentRows: currentRows,
      activeWorkbookFilePath: currentWorkbookPath,
    };
  }

  return {
    success: true,
    stepArtifact: artifact,
    stepOutputAttachmentId,
    currentOutputAttachmentIds: currentOutputIds,
    currentAttachmentRows: currentRows,
    activeWorkbookFilePath: currentWorkbookPath,
  };
}

/**
 * Executes a transform agent run step-by-step with state accumulation and persistence.
 * Orchestrates the flow: prepare execution context → invoke model turn → persist outputs.
 * Emits real-time events (step-start, tool-call, step-complete, error) for UI streaming.
 * Handles spreadsheet mutations, file uploads, and artifact persistence.
 * Rate limit errors trigger retry logic and emit retryable events.
 *
 * @param options - Step execution configuration (steps, run/agent rows, MCP tools, etc.)
 * @returns Object indicating success, pause status, and current output attachment IDs
 * @throws {RateLimitError} On rate limit (triggers retry in caller)
 * @author Maruf Bepary
 */
export async function runTransformSteps({
  steps,
  startFromStep,
  runRow,
  agentRow,
  userId,
  allServers,
  resolvedProvider,
  kbContext,
  availableSkills,
  selectedSkills,
  runMcpTools,
  runToolSourceMap,
  initialAttachmentRows,
  emit,
}: RunTransformStepsOptions) {
  const skillCatalog = availableSkills ?? [];
  const preloadedSkills = selectedSkills ?? [];
  let currentAttachmentRows = initialAttachmentRows;
  let activeWorkbookFilePath: string | null = null;
  let currentOutputAttachmentIds: string[] = [
    ...(runRow.outputAttachmentIds ?? []),
  ];

  for (let i = startFromStep; i < steps.length; i++) {
    const step = steps[i];

    try {
      await db
        .update(transformRun)
        .set({ updatedAt: new Date() })
        .where(eq(transformRun.id, runRow.id));
    } catch {
      log.warn("Heartbeat update failed (runId: {runId})", {
        runId: runRow.id,
        userId,
      });
    }

    await db
      .update(transformRun)
      .set({ currentStepIndex: i })
      .where(eq(transformRun.id, runRow.id));

    emit({
      type: "transform-step-start",
      runId: runRow.id,
      stepIndex: i,
      stepName: step.name,
      total: steps.length,
    });

    log.info(
      "Step started (runId: {runId}, stepIndex: {stepIndex}, stepName: {stepName})",
      {
        runId: runRow.id,
        stepIndex: i,
        stepName: step.name,
        userId,
      },
    );

    const { filteredTools, toolSourceMap, stepServerNames, systemPrompt } =
      await prepareStepExecution({
        step,
        agentRow,
        allServers,
        runMcpTools,
        runToolSourceMap,
        userId,
        skillCatalog,
        preloadedSkills,
        kbContext,
        activeWorkbookFilePath,
        currentAttachmentRows,
      });

    let turnResult: StepModelTurnResult;
    try {
      turnResult = await executeStepModelTurn({
        resolvedProvider,
        filteredTools,
        toolSourceMap,
        systemPrompt,
        currentAttachmentRows,
        activeWorkbookFilePath,
        runId: runRow.id,
        stepIndex: i,
        userId,
        emit,
      });
    } catch (stepErr) {
      await handleStepExecutionError(stepErr, step.name, runRow.id, emit);
      return { success: false };
    }

    activeWorkbookFilePath = turnResult.activeWorkbookFilePath;

    const outputResult = await handleStepArtifactOutput({
      step,
      stepIndex: i,
      userId,
      runId: runRow.id,
      stepArtifact: turnResult.stepArtifact,
      stepHasSpreadsheetMutations: turnResult.stepHasSpreadsheetMutations,
      activeWorkbookFilePath,
      currentOutputAttachmentIds,
      currentAttachmentRows,
      runMcpTools,
      runToolSourceMap,
      stepServerNames,
      emit,
    });

    if (!outputResult.success) {
      return { success: false };
    }

    currentOutputAttachmentIds = outputResult.currentOutputAttachmentIds;
    currentAttachmentRows = outputResult.currentAttachmentRows;
    activeWorkbookFilePath = outputResult.activeWorkbookFilePath;

    emit({
      type: "transform-step-complete",
      runId: runRow.id,
      stepIndex: i,
      summary: turnResult.stepSummary,
      stepData: {},
      artifact: outputResult.stepArtifact,
      outputAttachmentId: outputResult.stepOutputAttachmentId,
      outputAttachmentIds: currentOutputAttachmentIds,
    });

    log.info("Step completed (runId: {runId}, stepIndex: {stepIndex})", {
      runId: runRow.id,
      stepIndex: i,
      userId,
    });

    if (step.requiresReview) {
      await db
        .update(transformRun)
        .set({ status: "awaiting_review", currentStepIndex: i })
        .where(eq(transformRun.id, runRow.id));

      emit({
        type: "transform-review-required",
        runId: runRow.id,
        stepIndex: i,
      });

      log.info(
        "Paused for human review (runId: {runId}, stepIndex: {stepIndex})",
        { runId: runRow.id, stepIndex: i, userId },
      );

      return { success: true, paused: true, currentOutputAttachmentIds };
    }
  }

  return { success: true, paused: false, currentOutputAttachmentIds };
}
