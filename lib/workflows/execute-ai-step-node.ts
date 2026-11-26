import { generateText, isStepCount } from "ai";
import { env } from "@/config/env";
import { generateStructuredObject } from "@/lib/chat/generate-structured-object";
import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import {
  classifyAiStepError,
  collectStepTurnOutputs,
} from "@/lib/workflows/ai-step-turn-outputs";
import type { AttachmentRow } from "@/lib/workflows/build-file-context";
import {
  buildZodSchemaFromOutputFields,
  formatStructuredOutputSummary,
} from "@/lib/workflows/build-structured-output-zod";
import { compileWorkflowTemplate } from "@/lib/workflows/compile-template";
import { handleStepArtifactOutput } from "@/lib/workflows/step-artifact-output";
import { buildStepSystemPrompt } from "@/lib/workflows/step-system-prompt";
import {
  assertStepModelCapabilities,
  filterStepTools,
  resolveStepCanvasPolicy,
  resolveStepFileContext,
} from "@/lib/workflows/step-tool-filtering";
import { updateActiveWorkflowRun } from "@/lib/workflows/workflow-run-db";
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
  StructuredOutputField,
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
  agentPersonaPrompt?: string;
  effectiveTools?: string[];
}

/** Result returned by `executeAiStepNode`. */
export type ExecuteAiStepNodeResult =
  | {
      status: "completed";
      summary: string;
      structuredOutput?: Record<string, unknown>;
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

async function runStructuredExtraction(params: {
  model: ReturnType<ResolvedProvider["sdkProvider"]["chat"]>;
  fields: StructuredOutputField[];
  variableName: string;
  nodeName: string;
  system: string;
  prompt: string;
}): Promise<Record<string, unknown>> {
  const outputSchema = buildZodSchemaFromOutputFields(params.fields);
  return (await generateStructuredObject({
    model: params.model,
    schema: outputSchema,
    schemaName: params.variableName || "step_output",
    schemaDescription: `Structured output for workflow step "${params.nodeName}"`,
    system: params.system,
    prompt: params.prompt,
  })) as Record<string, unknown>;
}

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
    agentPersonaPrompt,
    effectiveTools,
  } = params;

  try {
    const isStructured = data.outputMode === "structured";
    const structuredFields = data.structuredOutputSchema?.fields ?? [];
    if (isStructured && structuredFields.length === 0) {
      return {
        status: "failed",
        errorMessage:
          "Structured output mode requires at least one output field.",
      };
    }

    const shouldDisableCanvas = isStructured || data.outputMode === "text";
    const effectiveStepData = shouldDisableCanvas
      ? { ...data, canvasMode: "disabled" as const }
      : data;

    const compiledPrompt = compileWorkflowTemplate(data.prompt, context);
    const { filteredTools, toolSourceMap, stepServerNames } = filterStepTools({
      step: effectiveTools
        ? { ...effectiveStepData, toolIds: effectiveTools }
        : effectiveStepData,
      workflowRow: effectiveTools
        ? { ...workflow, tools: effectiveTools }
        : workflow,
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
      effectiveStepData.canvasMode,
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
      agentPersonaPrompt,
    });

    const userMessage = resumedSummary
      ? `Approved/denied tool decisions were processed:\n${resumedSummary}\n\nPlease complete the task and summarise the outcome.`
      : "Please execute the task.";

    const model = resolvedProvider.sdkProvider.chat(resolvedProvider.modelId);

    if (isStructured && Object.keys(wrappedTools).length === 0) {
      const structuredOutput = await runStructuredExtraction({
        model,
        fields: structuredFields,
        variableName: data.variableName,
        nodeName,
        system: systemPrompt,
        prompt: userMessage,
      });

      return {
        status: "completed",
        summary: formatStructuredOutputSummary(structuredOutput),
        structuredOutput,
        artifact: null,
        currentOutputAttachmentIds,
        currentAttachmentRows,
        activeWorkbookFilePath,
        toolCalls: [],
      };
    }

    const pass1Instructions =
      isStructured && Object.keys(wrappedTools).length > 0
        ? `${systemPrompt}\n\nTarget structured output fields (ensure your final response includes all facts needed for these fields):\n${structuredFields
            .map(
              (f) =>
                `- ${f.name} (${f.type})${f.description ? `: ${f.description}` : ""}`,
            )
            .join("\n")}`
        : systemPrompt;

    const result = await generateText({
      model,
      instructions: pass1Instructions,
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

    let structuredOutput: Record<string, unknown> | undefined;
    if (isStructured) {
      const toolResultsText =
        turn.toolCalls.length > 0
          ? turn.toolCalls
              .map((tc) => {
                const serialized =
                  typeof tc.result === "string"
                    ? tc.result
                    : JSON.stringify(tc.result ?? null);
                return `[${tc.toolName}]: ${serialized.slice(0, 2000)}`;
              })
              .join("\n")
          : "";
      const extractionPrompt = [
        result.text || "Extract structured output from the completed task.",
        toolResultsText ? `Tool outputs:\n${toolResultsText}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      structuredOutput = await runStructuredExtraction({
        model,
        fields: structuredFields,
        variableName: data.variableName,
        nodeName,
        system:
          "Extract and format the final response into the required structured JSON schema.",
        prompt: extractionPrompt,
      });
    }

    return {
      status: "completed",
      summary: structuredOutput
        ? formatStructuredOutputSummary(structuredOutput)
        : result.text || "Step completed.",
      ...(structuredOutput ? { structuredOutput } : {}),
      artifact,
      outputAttachmentId: persisted.stepOutputAttachmentId,
      currentOutputAttachmentIds: persisted.currentOutputAttachmentIds,
      currentAttachmentRows: persisted.currentAttachmentRows,
      activeWorkbookFilePath: persisted.activeWorkbookFilePath,
      toolCalls: turn.toolCalls,
    };
  } catch (err) {
    const classified = classifyAiStepError(err);
    await updateActiveWorkflowRun(runId, {
      status: "failed",
      currentNodeId: nodeId,
      errorMessage: classified.message,
    });
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
