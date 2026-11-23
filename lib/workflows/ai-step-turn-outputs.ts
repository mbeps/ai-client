import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";
import { RATE_LIMIT_ERROR_CODE } from "@/lib/error/rate-limit-error-code";
import { ToolsNotSupportedError } from "@/lib/error/tools-not-supported-error";
import { VisionNotSupportedError } from "@/lib/error/vision-not-supported-error";
import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import { extractArtifactFromToolPayload } from "@/lib/workflows/extract-artifact-from-tool-payload";
import { extractUploadedFilePath } from "@/lib/workflows/extract-uploaded-file-path";
import { isSpreadsheetMutationTool } from "@/lib/workflows/is-spreadsheet-mutation-tool";
import type { ToolCallState } from "@/types/tool/tool-call";

/** Result summary extracted from resumed tool calls and AI SDK step turns. */
export interface StepTurnOutputs {
  stepHasSpreadsheetMutations: boolean;
  activeWorkbookFilePath: string | null;
  stepArtifact: Record<string, unknown> | null;
  toolCalls: ToolCallState[];
}

/**
 * Emits realtime tool events and aggregates artifact/spreadsheet side effects for an AI step.
 */
export async function collectStepTurnOutputs(params: {
  steps: any[];
  resumedResults: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
    result: unknown;
  }>;
  toolSourceMap: Record<string, string>;
  nodeId: string;
  initialWorkbookFilePath: string | null;
  emit: (data: WorkflowStreamEvent) => Promise<void> | void;
}): Promise<StepTurnOutputs> {
  const {
    steps,
    resumedResults,
    toolSourceMap,
    nodeId,
    initialWorkbookFilePath,
    emit,
  } = params;

  let stepHasSpreadsheetMutations = false;
  let activeWorkbookFilePath = initialWorkbookFilePath;
  let stepArtifact: Record<string, unknown> | null = null;
  const toolCalls: ToolCallState[] = [];

  const inspectResult = (
    toolCallId: string,
    toolName: string,
    args: unknown,
    payload: unknown,
  ) => {
    if (isSpreadsheetMutationTool(toolName)) {
      stepHasSpreadsheetMutations = true;
    }
    const extractedPath =
      extractUploadedFilePath(payload) ??
      (args ? extractUploadedFilePath(args) : null);
    if (extractedPath) {
      activeWorkbookFilePath = extractedPath;
    }
    if (toolName === "manage_artifact") {
      const extracted = extractArtifactFromToolPayload(payload);
      if (extracted) {
        stepArtifact = extracted;
      }
    }
    toolCalls.push({
      toolCallId,
      toolName,
      args,
      result: payload,
      serverName: toolSourceMap[toolName],
      status: "complete",
    });
  };

  for (const r of resumedResults) {
    inspectResult(r.toolCallId, r.toolName, r.args, r.result);
  }

  for (const stepInfo of steps) {
    const callById = new Map<string, unknown>();
    for (const tc of stepInfo.toolCalls ?? []) {
      callById.set(tc.toolCallId, tc.input ?? tc.args);
      await emit({
        type: "tool-call",
        nodeId,
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.input ?? tc.args,
        serverName: toolSourceMap[tc.toolName],
      });
    }

    for (const tr of stepInfo.toolResults ?? []) {
      const payload = tr.result ?? tr.output;
      const formattedResult =
        typeof payload === "object" && payload !== null
          ? JSON.stringify(payload, null, 2)
          : payload;
      await emit({
        type: "tool-result",
        nodeId,
        toolCallId: tr.toolCallId,
        toolName: tr.toolName,
        result: formattedResult,
        serverName: toolSourceMap[tr.toolName],
      });
      inspectResult(
        tr.toolCallId,
        tr.toolName,
        callById.get(tr.toolCallId),
        payload,
      );
    }
  }

  return {
    stepHasSpreadsheetMutations,
    activeWorkbookFilePath,
    stepArtifact,
    toolCalls,
  };
}

/**
 * Classifies errors raised inside an AI step into structured error codes and safe messages.
 */
export function classifyAiStepError(err: unknown): {
  message: string;
  code: string;
} {
  if (err instanceof ToolsNotSupportedError) {
    return { message: err.message, code: "TOOLS_NOT_SUPPORTED" };
  }
  if (err instanceof VisionNotSupportedError) {
    return { message: err.message, code: "VISION_NOT_SUPPORTED" };
  }
  if (isRateLimitError(err)) {
    return {
      message: normalizeRateLimitMessage(err),
      code: RATE_LIMIT_ERROR_CODE,
    };
  }
  return {
    message: err instanceof Error ? err.message : "Step failed",
    code: "ERROR",
  };
}
