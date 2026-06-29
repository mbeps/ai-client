import { db } from "@/drizzle/db";
import { transformRun, attachment } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateText, stepCountIs } from "ai";
import { logger } from "@/lib/logger";
import { RATE_LIMIT_ERROR_CODE } from "@/lib/constants/errors";
import {
  isRateLimitError,
  normalizeRateLimitMessage,
} from "@/lib/utils/error-utils";
import { persistTransformArtifact } from "@/lib/transform/persist-artifact";
import {
  extractUploadedFilePath,
  extractArtifactFromToolPayload,
  extractDownloadFilePayload,
  isSpreadsheetMutationTool,
} from "@/lib/transform/tool-payload-utils";
import type { TransformStep } from "@/types/transform/transform-agent";
import type { AttachmentRow } from "@/lib/transform/build-file-context";
import { buildFileContext } from "@/lib/transform/build-file-context";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";

/**
 * Configuration for running a sequence of transform agent steps.
 * @author Maruf Bepary
 */
interface RunTransformStepsOptions {
  steps: TransformStep[];
  startFromStep: number;
  runRow: { id: string };
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
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  initialAttachmentRows: AttachmentRow[];
  emit: (data: any) => void;
}

/**
 * Executes a transform agent run step-by-step with state accumulation and persistence.
 * Orchestrates the flow: generate LLM response → extract tool calls → execute tools → save outputs.
 * Emits real-time events (step-start, tool-call, step-complete, error) for UI streaming.
 * Handles spreadsheet mutations, file uploads, and artifact persistence.
 * Rate limit errors trigger retry logic and emit retryable events.
 *
 * State accumulation:
 * - activeWorkbookFilePath tracks the current spreadsheet for tool reuse
 * - currentOutputAttachmentIds tracks files generated in current step
 * - Step outputs persisted to S3 and linked in transform_run record
 *
 * @param options - Step execution configuration (steps, run/agent rows, MCP tools, etc.)
 * @throws {RateLimitError} On rate limit (triggers retry in caller)
 * @see {@link lib/transform/lifecycle-service.ts} for run initialization
 * @see {@link lib/transform/build-file-context.ts} for file context building
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
  runMcpTools,
  runToolSourceMap,
  initialAttachmentRows,
  emit,
}: RunTransformStepsOptions) {
  let currentAttachmentRows = initialAttachmentRows;
  let activeWorkbookFilePath: string | null = null;
  let currentOutputAttachmentIds: string[] = [];

  for (let i = startFromStep; i < steps.length; i++) {
    const step = steps[i];
    let stepHasSpreadsheetMutations = false;
    let stepPersistedSpreadsheetOutput = false;

    // Update current step index
    await db
      .update(transformRun)
      .set({ currentStepIndex: step.order })
      .where(eq(transformRun.id, runRow.id));

    emit({
      type: "transform-step-start",
      runId: runRow.id,
      stepIndex: i,
      stepName: step.name,
      total: steps.length,
    });

    logger.info(
      "[Transform AI] Step started",
      {
        runId: runRow.id,
        stepIndex: i,
        stepName: step.name,
      },
      userId,
    );

    // Filter servers by step config
    const stepServers =
      step.mcpServerIds.length > 0
        ? allServers.filter((s) => step.mcpServerIds.includes(s.id))
        : allServers;
    const stepServerNames = new Set(stepServers.map((s) => s.name));

    // Combine agent tools and step tools
    const allowedToolIds = new Set([
      ...(agentRow.tools || []),
      ...(step.toolIds || []),
    ]);

    const filteredEntries = Object.entries(runMcpTools).filter(([toolName]) => {
      const source = runToolSourceMap[toolName];
      const isInternal = source === "Internal" || source === "System";
      const fromAllowedServer = isInternal || stepServerNames.has(source);

      if (!fromAllowedServer) return false;
      if (allowedToolIds.size === 0) return true;

      return Array.from(allowedToolIds).some((id) => {
        const [, type, name] = id.split(":");
        return type === "tool" && name === toolName;
      });
    });

    const filteredTools = Object.fromEntries(filteredEntries);
    const toolSourceMap = Object.fromEntries(
      filteredEntries.map(([toolName]) => [
        toolName,
        runToolSourceMap[toolName],
      ]),
    ) as Record<string, string>;

    // Prevent re-upload when a single workbook is already loaded
    const isSingleWorkbookFlow = currentAttachmentRows.length <= 1;
    if (
      agentRow.requiresFileUpload &&
      activeWorkbookFilePath &&
      isSingleWorkbookFlow &&
      "upload_file" in filteredTools
    ) {
      delete filteredTools.upload_file;
      delete toolSourceMap.upload_file;
    }

    // Build per-step file context
    let fileContext = "";
    if (activeWorkbookFilePath) {
      fileContext = `A workbook is already loaded in the MCP session for this run. Reuse this exact file path for spreadsheet tools: ${activeWorkbookFilePath}. Do not call upload_file again unless explicitly instructed to switch source files.`;
    } else if (currentAttachmentRows.length > 0) {
      const { fileContext: builtContext } = await buildFileContext(
        currentAttachmentRows.map((r) => r.id),
        userId,
      );
      fileContext = builtContext;
    }

    // Build system prompt
    const systemPrompt = [
      agentRow.globalContext ? `Context:\n${agentRow.globalContext}` : null,
      kbContext ? `Additional Knowledge Context:\n${kbContext}` : null,
      "You are a helpful AI assistant performing a task.",
      `Instructions for this step:\n${step.prompt}`,
      `Use only the provided MCP tools. After completing the task, briefly summarise what you did.`,
      fileContext || null,
    ]
      .filter(Boolean)
      .join("\n\n");

    let stepSummary = "Step completed.";
    let stepArtifact: Record<string, unknown> | null = null;

    try {
      const result = await generateText({
        model: resolvedProvider.sdkProvider.chat(resolvedProvider.modelId),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Please execute the task." },
        ],
        tools: filteredTools,
        stopWhen: stepCountIs(10),
        maxRetries: 1,
      });

      if (result.steps) {
        for (const stepInfo of result.steps) {
          for (const tc of stepInfo.toolCalls) {
            const serverName = toolSourceMap[tc.toolName];
            emit({
              type: "tool-call",
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: (tc as any).args || (tc as any).input,
              serverName,
            });
          }
          for (const tr of stepInfo.toolResults) {
            const serverName = toolSourceMap[tr.toolName];
            const toolResultPayload =
              (tr as { result?: unknown; output?: unknown }).result ??
              (tr as { result?: unknown; output?: unknown }).output;

            if (isSpreadsheetMutationTool(tr.toolName)) {
              stepHasSpreadsheetMutations = true;
            }

            if (tr.toolName === "upload_file") {
              const uploadedPath = extractUploadedFilePath(toolResultPayload);
              if (uploadedPath) {
                activeWorkbookFilePath = uploadedPath;
                logger.info(
                  "[Transform AI] Active workbook file_path captured",
                  {
                    runId: runRow.id,
                    stepIndex: i,
                    activeWorkbookFilePath,
                  },
                  userId,
                );
              }
            }

            const formattedResult =
              typeof toolResultPayload === "object" &&
              toolResultPayload !== null
                ? JSON.stringify(toolResultPayload, null, 2)
                : toolResultPayload;

            if (tr.toolName === "manage_artifact") {
              const extractedArtifact =
                extractArtifactFromToolPayload(toolResultPayload);
              if (extractedArtifact) {
                stepArtifact = extractedArtifact;
              } else {
                logger.warn(
                  "[Transform AI] manage_artifact result had no extractable artifact",
                  {
                    runId: runRow.id,
                    stepIndex: i,
                    payloadType: typeof toolResultPayload,
                  },
                  userId,
                );
              }
            }

            emit({
              type: "tool-result",
              toolCallId: tr.toolCallId,
              toolName: tr.toolName,
              result: formattedResult,
              serverName,
            });
          }
        }
      }

      stepSummary = result.text || stepSummary;
    } catch (stepErr: unknown) {
      let msg = stepErr instanceof Error ? stepErr.message : "Step failed";
      let code = "ERROR";

      if (isRateLimitError(stepErr)) {
        msg = normalizeRateLimitMessage(stepErr);
        code = RATE_LIMIT_ERROR_CODE;
      }

      await db
        .update(transformRun)
        .set({ status: "failed", errorMessage: msg })
        .where(eq(transformRun.id, runRow.id));

      emit({
        type: "error",
        message: `Step "${step.name}" failed: ${msg}`,
        code,
      });
      return { success: false };
    }

    if (
      stepArtifact &&
      typeof (stepArtifact as any).type === "string" &&
      (stepArtifact as any).type.toLowerCase() === "spreadsheet" &&
      typeof (stepArtifact as any).content === "string"
    ) {
      const persisted = await persistTransformArtifact(
        { kind: "artifact", artifact: stepArtifact, stepIndex: i },
        userId,
        runRow.id,
      );

      if (persisted) {
        currentOutputAttachmentIds = persisted.outputAttachmentIds;
        stepPersistedSpreadsheetOutput = true;
        currentAttachmentRows = [persisted.attachmentRow];

        logger.info(
          "[Transform AI] Active workbook replaced with step output",
          {
            runId: runRow.id,
            stepIndex: i,
            activeWorkbookAttachmentId: persisted.attachmentRow.id,
          },
          userId,
        );
      }
    }

    if (
      stepHasSpreadsheetMutations &&
      activeWorkbookFilePath &&
      !stepPersistedSpreadsheetOutput &&
      "download_file" in runMcpTools
    ) {
      const downloadToolSource = runToolSourceMap.download_file;
      const canUseDownloadTool =
        typeof downloadToolSource === "string" &&
        stepServerNames.has(downloadToolSource);

      if (canUseDownloadTool) {
        const downloadTool = runMcpTools.download_file as {
          execute?: (args: { file_path: string }) => Promise<unknown>;
        };

        if (typeof downloadTool.execute === "function") {
          try {
            const downloaded = await downloadTool.execute({
              file_path: activeWorkbookFilePath,
            });
            const downloadPayload = extractDownloadFilePayload(downloaded);

            if (downloadPayload) {
              const persisted = await persistTransformArtifact(
                {
                  kind: "download",
                  fileContent: downloadPayload.fileContent,
                  filename:
                    downloadPayload.filename ||
                    currentAttachmentRows[0]?.name ||
                    `step-${i + 1}-output.xlsx`,
                  stepIndex: i,
                },
                userId,
                runRow.id,
              );

              if (persisted) {
                currentOutputAttachmentIds = persisted.outputAttachmentIds;
                stepPersistedSpreadsheetOutput = true;
                currentAttachmentRows = [persisted.attachmentRow];

                logger.info(
                  "[Transform AI] Persisted step output from download_file fallback",
                  { runId: runRow.id, stepIndex: i },
                  userId,
                );
              }
            }
          } catch (downloadErr) {
            logger.warn(
              "[Transform AI] download_file fallback persistence failed",
              { downloadErr, runId: runRow.id, stepIndex: i },
              userId,
            );
          }
        }
      }
    }

    if (
      stepHasSpreadsheetMutations &&
      activeWorkbookFilePath &&
      !stepPersistedSpreadsheetOutput
    ) {
      const errorMessage = `Step "${step.name}" changed workbook data, but no spreadsheet artifact output was persisted. Refusing to complete with stale output.`;

      await db
        .update(transformRun)
        .set({ status: "failed", errorMessage })
        .where(eq(transformRun.id, runRow.id));

      emit({ type: "error", message: errorMessage });
      return { success: false };
    }

    emit({
      type: "transform-step-complete",
      runId: runRow.id,
      stepIndex: i,
      summary: stepSummary,
      stepData: {},
      artifact: stepArtifact,
    });

    logger.info(
      "[Transform AI] Step completed",
      { runId: runRow.id, stepIndex: i },
      userId,
    );
  }

  return { success: true, currentOutputAttachmentIds };
}
