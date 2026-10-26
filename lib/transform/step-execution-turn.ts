import { generateText, isStepCount } from "ai";
import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";
import { RATE_LIMIT_ERROR_CODE } from "@/lib/error/rate-limit-error-code";
import { ToolsNotSupportedError } from "@/lib/error/tools-not-supported-error";
import { VisionNotSupportedError } from "@/lib/error/vision-not-supported-error";
import { getLogger } from "@/lib/logger";
import type { AttachmentRow } from "@/lib/transform/build-file-context";
import { extractArtifactFromToolPayload } from "@/lib/transform/extract-artifact-from-tool-payload";
import { extractUploadedFilePath } from "@/lib/transform/extract-uploaded-file-path";
import { isSpreadsheetMutationTool } from "@/lib/transform/is-spreadsheet-mutation-tool";
import { assertStepModelCapabilities } from "@/lib/transform/step-tool-filtering";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";

const log = getLogger(["app", "transform", "steps"]);

/**
 * Processes an individual tool execution result during a workflow step turn.
 *
 * Emits realtime tool-call telemetry events, checks whether the tool performed
 * a spreadsheet mutation, captures newly uploaded workbook filepaths, and extracts
 * produced artifacts.
 *
 * @param tr - Raw tool execution result object
 * @param toolSourceMap - Mapping of tool names to their providing MCP server names
 * @param emit - Realtime event dispatcher callback for step streaming updates
 * @param runId - Workflow run identifier
 * @param stepIndex - Zero-based index of the currently executing workflow step
 * @param userId - ID of the authenticated user owning the run
 * @returns Metadata describing mutation status, active workbook filepath, and extracted artifact
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
 * Performs emit step tool calls.
 *
 * @param toolCalls - List of tool call definitions and arguments
 * @param toolSourceMap - Target tool source map
 * @param emit - Target emit
 * @returns The resolved result
 * @author Maruf Bepary
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
 * Performs process step execution turn.
 *
 * @param steps - Target steps
 * @param toolSourceMap - Target tool source map
 * @param emit - Target emit
 * @param runId - Workflow run identifier
 * @param stepIndex - Target step index
 * @param userId - User identifier
 * @param initialWorkbookFilePath - Target initial workbook file path
 * @returns The resolved result
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
 * Represents execute step model turn params.
 *
 * @author Maruf Bepary
 */
export interface ExecuteStepModelTurnParams {
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
 * Represents step model turn result.
 *
 * @author Maruf Bepary
 */
export interface StepModelTurnResult {
  stepSummary: string;
  stepArtifact: Record<string, unknown> | null;
  activeWorkbookFilePath: string | null;
  stepHasSpreadsheetMutations: boolean;
}

/**
 * Performs execute step model turn.
 *
 * @param props - Target props
 * @returns The resolved result
 * @author Maruf Bepary
 */
export async function executeStepModelTurn({
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
 * Performs handle step execution error.
 *
 * @param stepErr - Target step err
 * @param stepName - Target step name
 * @param runId - Workflow run identifier
 * @param emit - Target emit
 * @returns The resolved result
 * @author Maruf Bepary
 */
export async function handleStepExecutionError(
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
