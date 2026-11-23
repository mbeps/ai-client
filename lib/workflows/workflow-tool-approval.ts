import { createHmac, randomUUID } from "crypto";
import { env } from "@/config/env";
import { buildToolApproval } from "@/config/tool-approval";
import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import type { PendingApproval, ToolApprovalMap } from "@/types/tool/approval";
import type {
  AiStepNodeData,
  ArtifactCanvasType,
  WorkflowApprovalConfig,
} from "@/types/workflows/workflow";

/** Decision payload pairing a persisted approval request with the user's verdict. */
export interface ResumedToolDecision {
  approval: PendingApproval;
  approved: boolean;
}

/**
 * Resolves the effective per-tool approval map for an AI step node by combining
 * node-level override (`inherit` / `auto` / `ask`) with workflow-level `approvalConfig`.
 */
export function resolveWorkflowToolApprovalMap(
  toolNames: readonly string[],
  nodeMode: AiStepNodeData["toolApprovalMode"],
  approvalConfig: WorkflowApprovalConfig,
  toolSourceMap: Record<string, string>,
): ToolApprovalMap {
  const effectiveMode =
    !nodeMode || nodeMode === "inherit"
      ? approvalConfig.toolApprovalMode
      : nodeMode;

  const map = buildToolApproval(toolNames, effectiveMode);

  if (effectiveMode === "ask" && approvalConfig.autoApprovedTools.length > 0) {
    const autoSet = new Set(approvalConfig.autoApprovedTools);
    for (const name of toolNames) {
      const source = toolSourceMap[name];
      if (
        autoSet.has(name) ||
        (source && autoSet.has(`${source}:tool:${name}`))
      ) {
        map[name] = "not-applicable";
      }
    }
  }

  return map;
}

/**
 * Wraps `manage_artifact` when an explicit canvas output type is enforced so that
 * any generated artifact is normalized to the required `ArtifactCanvasType`.
 */
export function applyCanvasToolEnforcement(
  tools: Record<string, any>,
  enforcedType: ArtifactCanvasType | null,
): Record<string, any> {
  if (!enforcedType || !tools.manage_artifact?.execute) {
    return tools;
  }

  const original = tools.manage_artifact;
  return {
    ...tools,
    manage_artifact: {
      ...original,
      execute: async (args: Record<string, unknown>, opts?: unknown) =>
        original.execute({ ...args, type: enforcedType }, opts),
    },
  };
}

/**
 * Wraps tools marked `"user-approval"` in `approvalMap` so invoking them pauses
 * step execution cleanly and records `PendingApproval` payloads for Inngest `waitForEvent`.
 */
export function wrapToolsForWorkflowApproval(params: {
  tools: Record<string, any>;
  approvalMap: ToolApprovalMap;
  toolSourceMap: Record<string, string>;
  interceptedApprovals: PendingApproval[];
  resumedToolDecisions?: ResumedToolDecision[];
}): Record<string, any> {
  const {
    tools,
    approvalMap,
    toolSourceMap,
    interceptedApprovals,
    resumedToolDecisions,
  } = params;

  const approvedOnceNames = new Set(
    (resumedToolDecisions ?? [])
      .filter((d) => d.approved)
      .map((d) => d.approval.toolName),
  );

  const wrapped: Record<string, any> = {};
  for (const [name, toolDef] of Object.entries(tools)) {
    if (
      approvalMap[name] !== "user-approval" ||
      approvedOnceNames.has(name) ||
      typeof toolDef?.execute !== "function"
    ) {
      wrapped[name] = toolDef;
      continue;
    }

    wrapped[name] = {
      ...toolDef,
      execute: async (args: unknown, opts?: { toolCallId?: string }) => {
        const approvalId = randomUUID();
        const toolCallId = opts?.toolCallId || randomUUID();
        const secret = env.TOOL_APPROVAL_SECRET || env.BETTER_AUTH_SECRET;
        const signature = createHmac("sha256", secret)
          .update(`${approvalId}:${toolCallId}:${name}`)
          .digest("hex");

        interceptedApprovals.push({
          approvalId,
          toolCallId,
          toolName: name,
          serverName: toolSourceMap[name],
          args,
          signature,
        });

        return {
          pausedForApproval: true,
          approvalId,
          message: `Tool "${name}" paused awaiting user approval.`,
        };
      },
    };
  }

  return wrapped;
}

/**
 * Executes approved tool calls from a resumed approval round in emission order
 * and emits `tool-call` / `tool-result` events for both approved and denied tools.
 */
export async function executeResumedToolDecisions(params: {
  decisions: ResumedToolDecision[];
  rawTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  nodeId: string;
  emit: (data: WorkflowStreamEvent) => Promise<void> | void;
}): Promise<{
  summaryLines: string[];
  rawResults: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
    result: unknown;
  }>;
}> {
  const { decisions, rawTools, toolSourceMap, nodeId, emit } = params;
  const summaryLines: string[] = [];
  const rawResults: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
    result: unknown;
  }> = [];

  for (const { approval, approved } of decisions) {
    const serverName = toolSourceMap[approval.toolName] ?? approval.serverName;
    await emit({
      type: "tool-call",
      nodeId,
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      args: approval.args,
      serverName,
    });

    if (!approved) {
      const deniedResult = { error: "Denied by user" };
      await emit({
        type: "tool-result",
        nodeId,
        toolCallId: approval.toolCallId,
        toolName: approval.toolName,
        result: deniedResult,
        serverName,
      });
      rawResults.push({
        toolCallId: approval.toolCallId,
        toolName: approval.toolName,
        args: approval.args,
        result: deniedResult,
      });
      summaryLines.push(`Tool "${approval.toolName}" was denied by the user.`);
      continue;
    }

    const toolDef = rawTools[approval.toolName];
    const execResult =
      typeof toolDef?.execute === "function"
        ? await toolDef.execute(approval.args ?? {}, {
            toolCallId: approval.toolCallId,
            messages: [],
          })
        : { error: `Tool "${approval.toolName}" is no longer available` };

    await emit({
      type: "tool-result",
      nodeId,
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      result: execResult,
      serverName,
    });
    rawResults.push({
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      args: approval.args,
      result: execResult,
    });
    summaryLines.push(
      `Tool "${approval.toolName}" executed with result: ${JSON.stringify(execResult)}`,
    );
  }

  return { summaryLines, rawResults };
}
