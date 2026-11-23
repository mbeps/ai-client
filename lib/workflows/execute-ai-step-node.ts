import { generateText, isStepCount } from "ai";
import { and, eq, ne } from "drizzle-orm";
import { env } from "@/config/env";
import { db } from "@/drizzle/db";
import { workflowRun } from "@/drizzle/schemas/workflow-schema";
import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import {
  classifyAiStepError,
  collectStepTurnOutputs,
} from "@/lib/workflows/ai-step-turn-outputs";
import type { AttachmentRow } from "@/lib/workflows/build-file-context";
import { compileWorkflowTemplate } from "@/lib/workflows/compile-template";
import { handleStepArtifactOutput } from "@/lib/workflows/step-artifact-output";
import { buildStepSystemPrompt } from "@/lib/workflows/step-system-prompt";
import {
  assertStepModelCapabilities,
  filterStepTools,
  resolveStepCanvasPolicy,
  resolveStepFileContext,
} from "@/lib/workflows/step-tool-filtering";
import {
  applyCanvasToolEnforcement,
  executeResumedToolDecisions,
  type ResumedToolDecision,
  resolveWorkflowToolApprovalMap,
  wrapToolsForWorkflowApproval,
} from "@/lib/workflows/workflow-tool-approval";
import type { Agent } from "@/types/agent/agent";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import type { SkillSummary } from "@/types/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";
import type { PendingApproval } from "@/types/tool/approval";
import type { ToolCallState } from "@/types/tool/tool-call";
import type {
  AiStepNodeData,
  WorkflowApprovalConfig,
  WorkflowCanvasConfig,
} from "@/types/workflows/workflow";

/** Parameters for `executeAiStepNode`. */
export interface ExecuteAiStepNodeParams {
  runId: string;
  nodeId: string;
  nodeName: string;
  stepIndex: number;
  userId: string;
  data: AiStepNodeData;
  workflow: {
    globalContext: string | null;
    tools: string[];
    requiresFileUpload: boolean;
    canvasConfig: WorkflowCanvasConfig;
    approvalConfig: WorkflowApprovalConfig;
  };
  context: Record<string, unknown>;
  resolvedProvider: ResolvedProvider;
  allServers: any[];
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  kbContext: string;
  skillCatalog: SkillSummary[];
  preloadedSkills: SkillRow[];
  linkedSubagents: Agent[];
  currentAttachmentRows: AttachmentRow[];
  currentOutputAttachmentIds: string[];
  activeWorkbookFilePath: string | null;
  activeArtifact?: ArtifactData | null;
  dryRun: boolean;
  emit: (data: WorkflowStreamEvent) => Promise<void> | void;
  resumedToolDecisions?: ResumedToolDecision[];
}

/** Result returned by `executeAiStepNode`. */
export type ExecuteAiStepNodeResult =
  | {
      status: "completed";
      summary: string;
      artifact: ArtifactData | null;
      outputAttachmentId?: string;
      currentOutputAttachmentIds: string[];
      currentAttachmentRows: AttachmentRow[];
      activeWorkbookFilePath: string | null;
      toolCalls: ToolCallState[];
    }
  | {
      status: "awaiting_tool_approval";
      pendingApprovals: PendingApproval[];
      toolCalls: ToolCallState[];
    }
  | {
      status: "failed";
      errorMessage: string;
      errorCode?: string;
    };

/**
 * Executes an `ai_step` workflow node: compiles prompt templates, enforces canvas policies
 * and tool execution approvals, runs AI SDK `generateText`, and persists output artifacts.
 */
export async function executeAiStepNode(
  params: ExecuteAiStepNodeParams,
): Promise<ExecuteAiStepNodeResult> {
  const {
    runId,
    nodeId,
    nodeName,
    stepIndex,
    userId,
    data,
    workflow,
    context,
    resolvedProvider,
    allServers,
    runMcpTools,
    runToolSourceMap,
    kbContext,
    skillCatalog,
    preloadedSkills,
    linkedSubagents,
    currentAttachmentRows,
    currentOutputAttachmentIds,
    activeWorkbookFilePath,
    activeArtifact,
    dryRun,
    emit,
    resumedToolDecisions,
  } = params;

  try {
    const compiledPrompt = compileWorkflowTemplate(data.prompt, context);
    const { filteredTools, toolSourceMap, stepServerNames } = filterStepTools({
      step: data,
      workflowRow: workflow,
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
    });

    assertStepModelCapabilities(
      resolvedProvider,
      filteredTools,
      currentAttachmentRows,
    );

    const canvasPolicy = resolveStepCanvasPolicy(
      data.canvasMode,
      workflow.canvasConfig,
    );
    const enforcedTools = applyCanvasToolEnforcement(
      filteredTools,
      canvasPolicy.enforcedType,
    );

    const approvalMap = resolveWorkflowToolApprovalMap(
      Object.keys(enforcedTools),
      data.toolApprovalMode,
      workflow.approvalConfig,
      toolSourceMap,
    );

    let resumedSummary = "";
    let resumedRawResults: Array<{
      toolCallId: string;
      toolName: string;
      args: unknown;
      result: unknown;
    }> = [];

    if (resumedToolDecisions && resumedToolDecisions.length > 0) {
      const resumed = await executeResumedToolDecisions({
        decisions: resumedToolDecisions,
        rawTools: enforcedTools,
        toolSourceMap,
        nodeId,
        emit,
      });
      resumedSummary = resumed.summaryLines.join("\n");
      resumedRawResults = resumed.rawResults;
    }

    const interceptedApprovals: PendingApproval[] = [];
    const wrappedTools = wrapToolsForWorkflowApproval({
      tools: enforcedTools,
      approvalMap,
      toolSourceMap,
      interceptedApprovals,
      resumedToolDecisions,
    });

    const fileContext = await resolveStepFileContext(
      activeWorkbookFilePath,
      currentAttachmentRows,
      userId,
    );

    const systemPrompt = buildStepSystemPrompt({
      compiledPrompt,
      nodeData: data,
      workflowRow: {
        globalContext: workflow.globalContext,
        canvasConfig: workflow.canvasConfig,
      },
      filteredTools: wrappedTools,
      skillCatalog,
      preloadedSkills,
      kbContext,
      fileContext,
      dryRun,
      linkedSubagents,
      activeArtifact,
    });

    const userMessage = resumedSummary
      ? `Approved/denied tool decisions were processed:\n${resumedSummary}\n\nPlease complete the task and summarise the outcome.`
      : "Please execute the task.";

    const result = await generateText({
      model: resolvedProvider.sdkProvider.chat(resolvedProvider.modelId),
      instructions: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: wrappedTools,
      stopWhen: isStepCount(env.CHAT_MAX_STEPS),
      maxRetries: 1,
    });

    if (interceptedApprovals.length > 0) {
      return {
        status: "awaiting_tool_approval",
        pendingApprovals: interceptedApprovals,
        toolCalls: [],
      };
    }

    const turn = await collectStepTurnOutputs({
      steps: result.steps ?? [],
      resumedResults: resumedRawResults,
      toolSourceMap,
      nodeId,
      initialWorkbookFilePath: activeWorkbookFilePath,
      emit,
    });

    const persisted = await handleStepArtifactOutput({
      stepName: nodeName,
      stepIndex,
      userId,
      runId,
      stepArtifact: turn.stepArtifact,
      stepHasSpreadsheetMutations: turn.stepHasSpreadsheetMutations,
      activeWorkbookFilePath: turn.activeWorkbookFilePath,
      currentOutputAttachmentIds,
      currentAttachmentRows,
      runMcpTools,
      runToolSourceMap,
      stepServerNames,
      emit,
    });

    if (!persisted.success) {
      return {
        status: "failed",
        errorMessage: `Step "${nodeName}" failed artifact persistence`,
      };
    }

    const rawArtifact = (persisted.stepArtifact as ArtifactData | null) ?? null;
    const artifact =
      rawArtifact &&
      workflow.canvasConfig.sharedCanvas !== false &&
      activeArtifact?.id
        ? { ...rawArtifact, id: activeArtifact.id }
        : rawArtifact;

    return {
      status: "completed",
      summary: result.text || "Step completed.",
      artifact,
      outputAttachmentId: persisted.stepOutputAttachmentId,
      currentOutputAttachmentIds: persisted.currentOutputAttachmentIds,
      currentAttachmentRows: persisted.currentAttachmentRows,
      activeWorkbookFilePath: persisted.activeWorkbookFilePath,
      toolCalls: turn.toolCalls,
    };
  } catch (err) {
    const classified = classifyAiStepError(err);
    await db
      .update(workflowRun)
      .set({ status: "failed", errorMessage: classified.message })
      .where(and(eq(workflowRun.id, runId), ne(workflowRun.status, "failed")));
    await emit({
      type: "error",
      nodeId,
      message: `Node "${nodeName}" failed: ${classified.message}`,
      code: classified.code,
    });
    return {
      status: "failed",
      errorMessage: classified.message,
      errorCode: classified.code,
    };
  }
}
