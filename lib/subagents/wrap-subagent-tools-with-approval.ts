import { chatApprovalRegistry } from "@/lib/chat/chat-approval-registry";
import type { ChatStreamEvent } from "@/lib/inngest/chat-channel";
import type { PendingApproval, ToolApprovalMap } from "@/types/tool/approval";

interface QueuedSubagentApproval {
  approval: PendingApproval;
  runOriginal: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Parameters for wrapping a subagent's toolset with sequential human-in-the-loop
 * approval gating.
 */
export interface WrapSubagentToolsWithApprovalParams {
  workerTools: Record<string, any>;
  toolApprovalMap: ToolApprovalMap;
  subagentId: string;
  subagentName: string;
  toolSourceMap: Record<string, string>;
  toolServerIdMap: Record<string, string>;
  assistantMessageId: string;
  chatId: string;
  abortSignal: AbortSignal;
  emit: (data: ChatStreamEvent) => Promise<void>;
  persistPendingApprovals: (
    approvals: PendingApproval[],
    round: number,
  ) => Promise<void>;
  getNextRound: () => number;
  maxRounds: number;
}

/**
 * Wraps any subagent tool marked `"user-approval"` in `toolApprovalMap` with a
 * microtask-coalesced approval gate.
 *
 * Multiple gated tools invoked in the same `ToolLoopAgent` step are batched in
 * emission order, persisted to PostgreSQL, broadcast via `tool-approval-required`,
 * and awaited via `chatApprovalRegistry`. Approved tools execute sequentially
 * in emission order; denied tools return `{ error: "Denied by user" }` without
 * invoking the underlying `execute` handler.
 */
export function wrapSubagentToolsWithApproval(
  params: WrapSubagentToolsWithApprovalParams,
): Record<string, any> {
  const {
    workerTools,
    toolApprovalMap,
    subagentId,
    subagentName,
    toolSourceMap,
    toolServerIdMap,
    assistantMessageId,
    abortSignal,
    emit,
    persistPendingApprovals,
    getNextRound,
    maxRounds,
  } = params;

  let pendingBatch: QueuedSubagentApproval[] = [];
  let flushScheduled = false;

  const flushBatch = async (): Promise<void> => {
    flushScheduled = false;
    const batch = pendingBatch;
    pendingBatch = [];

    const round = getNextRound();
    if (round > maxRounds) {
      for (const entry of batch) {
        entry.resolve({ error: "Maximum tool approval rounds exceeded" });
      }
      return;
    }

    const approvals = batch.map((entry) => entry.approval);

    let decisions: Map<string, boolean>;
    try {
      await persistPendingApprovals(approvals, round);
      await emit({
        type: "tool-approval-required",
        approvals,
        round,
      });

      decisions = await chatApprovalRegistry.waitForDecisions(
        assistantMessageId,
        approvals.map((a) => a.approvalId),
        abortSignal,
      );
    } catch (error) {
      for (const entry of batch) {
        entry.reject(error);
      }
      return;
    }

    for (const entry of batch) {
      if (decisions.get(entry.approval.approvalId) !== true) {
        entry.resolve({ error: "Denied by user" });
        continue;
      }

      try {
        const result = await entry.runOriginal();
        entry.resolve(result);
      } catch (error) {
        entry.reject(error);
      }
    }
  };

  const wrapped: Record<string, any> = {};

  for (const [toolName, toolDef] of Object.entries(workerTools)) {
    if (toolApprovalMap[toolName] !== "user-approval") {
      wrapped[toolName] = toolDef;
      continue;
    }

    const originalExecute = toolDef?.execute;
    wrapped[toolName] = {
      ...toolDef,
      execute: (args: unknown, execOptions: Record<string, unknown> = {}) => {
        const toolCallId =
          typeof execOptions.toolCallId === "string" && execOptions.toolCallId
            ? execOptions.toolCallId
            : crypto.randomUUID();

        const approval: PendingApproval = {
          approvalId: crypto.randomUUID(),
          toolCallId,
          toolName,
          serverName: toolSourceMap[toolName],
          serverId: toolServerIdMap[toolName],
          subagentId,
          subagentName,
          args,
          signature: "",
        };

        return new Promise((resolve, reject) => {
          pendingBatch.push({
            approval,
            runOriginal: async () => {
              if (typeof originalExecute !== "function") {
                return { error: "Tool has no execute handler" };
              }
              return originalExecute(args, execOptions);
            },
            resolve,
            reject,
          });

          if (!flushScheduled) {
            flushScheduled = true;
            queueMicrotask(() => {
              void flushBatch();
            });
          }
        });
      },
    };
  }

  return wrapped;
}
