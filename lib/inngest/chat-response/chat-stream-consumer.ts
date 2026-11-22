import { DEFAULT_LINKABLE_BUILT_IN_AGENTS } from "@/config/built-in-agents";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import {
  createInlineReasoningParser,
  extractReasoningFromDelta,
} from "@/lib/chat/stream/reasoning-stream-parser";
import { toAppError } from "@/lib/error/to-app-error";
import type { ChatStreamEvent, chatChannel } from "@/lib/inngest/chat-channel";
import type {
  CompletedToolRecord,
  ConsumeModelStreamResult,
} from "@/lib/inngest/chat-response/chat-response-types";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { resolveTargetAgent } from "@/lib/subagents/create-subagent-dispatch-tool";
import type { Agent } from "@/types/agent/agent";
import type { PendingApproval } from "@/types/tool/approval";

const log = getLogger(["inngest", "chat", "response"]);

/**
 * Formats tool error payload into a reliable error string.
 *
 * @param rawErr - Target raw err
 * @returns The resolved result
 * @author Maruf Bepary
 */
function formatToolErrorMessage(rawErr: unknown): string {
  if (rawErr instanceof Error) {
    return rawErr.message;
  }
  if (typeof rawErr === "string") {
    return rawErr;
  }
  return JSON.stringify(rawErr ?? "Tool execution failed");
}

/**
 * Creates a bound emitter function publishing events to Inngest Realtime.
 *
 * @param abortSignal - Target abort signal
 * @param stream - Target stream
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function createStreamEmitter(
  abortSignal: AbortSignal,
  stream: ReturnType<typeof chatChannel>["stream"],
) {
  return async (data: ChatStreamEvent) => {
    if (abortSignal.aborted) return;
    try {
      await inngest.realtime.publish(stream, data);
    } catch (err) {
      log.warn("Failed to publish chat stream event to Inngest Realtime", {
        error: err instanceof Error ? err.message : String(err),
        type: data.type,
      });
    }
  };
}

/**
 * Handles a tool-call chunk by updating completedTools and emitting event.
 * When `delegate_task` is called, enriches `args` with the resolved `agentId` and `agentName`
 * so the frontend trace badge can display custom subagent names instead of generic role aliases.
 *
 * @param chunk - Target chunk
 * @param completedTools - Target completed tools
 * @param toolSourceMap - Target tool source map
 * @param emit - Target emit
 * @param linkedSubagents - Optional linked subagents to resolve custom agent metadata against
 * @returns The resolved result
 * @author Maruf Bepary
 */
interface ParkedToolOutcome {
  toolName: string;
  result: unknown;
  serverName?: string;
}

export interface StreamApprovalContext {
  toolServerIdMap?: Record<string, string>;
  round: number;
  maxRounds?: number;
}

async function handleToolCallChunk(
  chunk: any,
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
  linkedSubagents?: readonly Agent[],
  parkedResults?: Map<string, ParkedToolOutcome>,
): Promise<void> {
  const serverName = toolSourceMap[chunk.toolName];
  let args = chunk.input;
  const isSubagent =
    chunk.toolName === "delegate_task" ||
    chunk.toolName === INTERNAL_TOOL_IDS.DELEGATE_TASK;
  if (isSubagent && chunk.input && typeof chunk.input === "object") {
    const rawInput = chunk.input as Record<string, unknown>;
    const targetAgent = resolveTargetAgent(
      linkedSubagents ?? DEFAULT_LINKABLE_BUILT_IN_AGENTS,
      typeof rawInput.agent === "string" ? rawInput.agent : undefined,
      typeof rawInput.role === "string" ? rawInput.role : undefined,
    );
    if (targetAgent) {
      args = {
        ...rawInput,
        agentId: targetAgent.id,
        agentName: targetAgent.name,
      };
    }
  }
  const parked = parkedResults?.get(chunk.toolCallId);
  if (parked) {
    parkedResults?.delete(chunk.toolCallId);
  }
  completedTools.push({
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    args,
    serverName,
    ...(parked !== undefined ? { result: parked.result } : {}),
  });
  await emit({
    type: "tool-call",
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    args,
    serverName,
  });
}

const MAX_SUBAGENT_PART_OUTPUT_CHARS = 4000;

function boundToolPartOutput(output: unknown): unknown {
  if (typeof output === "string") {
    return output.length > MAX_SUBAGENT_PART_OUTPUT_CHARS
      ? `${output.slice(0, MAX_SUBAGENT_PART_OUTPUT_CHARS)}\n[... truncated]`
      : output;
  }
  if (output !== null && typeof output === "object") {
    try {
      const serialized = JSON.stringify(output);
      if (serialized.length > MAX_SUBAGENT_PART_OUTPUT_CHARS) {
        return `${serialized.slice(0, MAX_SUBAGENT_PART_OUTPUT_CHARS)}\n[... truncated]`;
      }
    } catch {
      return "[unserializable output]";
    }
  }
  return output;
}

/**
 * Preserves the structured subagent UIMessage (parts + metadata) for UI rendering
 * and PostgreSQL persistence while capping oversized nested tool outputs.
 */
function boundSubagentResultForPersistence(rawResult: unknown): unknown {
  if (rawResult === undefined || rawResult === null) {
    return "Subagent finished with no text output.";
  }
  if (typeof rawResult !== "object") {
    return rawResult;
  }
  const msg = rawResult as Record<string, unknown>;
  if (!Array.isArray(msg.parts)) {
    return rawResult;
  }
  return {
    ...msg,
    parts: msg.parts.map((part) => {
      if (
        part &&
        typeof part === "object" &&
        "output" in part &&
        (part as { output?: unknown }).output !== undefined
      ) {
        return {
          ...part,
          output: boundToolPartOutput((part as { output?: unknown }).output),
        };
      }
      return part;
    }),
  };
}

/**
 * Handles a tool-result chunk by bounding subagent UIMessage payloads and emitting event.
 *
 * @param chunk - Target chunk
 * @param completedTools - Target completed tools
 * @param toolSourceMap - Target tool source map
 * @param emit - Target emit
 * @returns The resolved result
 * @author Maruf Bepary
 */
async function handleToolResultChunk(
  chunk: any,
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
  parkedResults?: Map<string, ParkedToolOutcome>,
): Promise<void> {
  const isPreliminary = Boolean(chunk.preliminary);
  const rawResult = chunk.output;
  const tc = completedTools.find((t) => t.toolCallId === chunk.toolCallId);
  const isSubagent =
    chunk.toolName === "delegate_task" ||
    chunk.toolName === INTERNAL_TOOL_IDS.DELEGATE_TASK;
  const finalResult = isSubagent
    ? boundSubagentResultForPersistence(rawResult)
    : rawResult;

  const serverName = tc?.serverName ?? toolSourceMap[chunk.toolName];
  if (!isPreliminary) {
    if (tc) {
      tc.result = finalResult;
    } else {
      parkedResults?.set(chunk.toolCallId, {
        toolName: chunk.toolName,
        result: finalResult,
        serverName,
      });
    }
  }
  await emit({
    type: "tool-result",
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    result: isPreliminary ? rawResult : finalResult,
    serverName,
    preliminary: isPreliminary,
  });
}

/**
 * Handles a tool-error chunk by formatting error message and emitting event.
 *
 * @param chunk - Target chunk
 * @param completedTools - Target completed tools
 * @param toolSourceMap - Target tool source map
 * @param emit - Target emit
 * @returns The resolved result
 * @author Maruf Bepary
 */
async function handleToolErrorChunk(
  chunk: any,
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
): Promise<void> {
  const tc = completedTools.find((t) => t.toolCallId === chunk.toolCallId);
  const errorResult = { error: formatToolErrorMessage(chunk.error) };
  if (tc) {
    tc.result = errorResult;
  }
  const serverName = tc?.serverName ?? toolSourceMap[chunk.toolName];
  await emit({
    type: "tool-result",
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    result: errorResult,
    serverName,
  });
}

/**
 * Milliseconds to coalesce streaming text and reasoning deltas before publishing.
 */
export const DELTA_COALESCE_INTERVAL_MS = 40;

/**
 * Handles non-delta stream chunks by delegating to corresponding tool handlers.
 *
 * @param chunk - Target chunk
 * @param completedTools - Target completed tools
 * @param toolSourceMap - Target tool source map
 * @param emit - Target emit
 * @author Maruf Bepary
 */
async function handleToolOutputDeniedChunk(
  chunk: any,
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
  parkedResults: Map<string, ParkedToolOutcome>,
): Promise<void> {
  const deniedResult = { error: "Denied by user" };
  const tc = completedTools.find((t) => t.toolCallId === chunk.toolCallId);
  const toolName = chunk.toolName ?? tc?.toolName ?? "tool";
  const serverName = tc?.serverName ?? toolSourceMap[toolName];

  if (tc) {
    tc.result = deniedResult;
  } else {
    parkedResults.set(chunk.toolCallId, {
      toolName,
      result: deniedResult,
      serverName,
    });
  }

  await emit({
    type: "tool-result",
    toolCallId: chunk.toolCallId,
    toolName,
    result: deniedResult,
    serverName,
  });
}

async function handleToolApprovalRequestChunk(
  chunk: any,
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
  blockedCallIds: Set<string>,
  pendingApprovals: PendingApproval[],
  approvalContext?: StreamApprovalContext,
): Promise<void> {
  if (chunk.isAutomatic === true) {
    return;
  }

  const toolCallId: string = chunk.toolCall?.toolCallId ?? chunk.toolCallId;
  const toolName: string = chunk.toolCall?.toolName ?? chunk.toolName;
  const args = chunk.toolCall?.input ?? chunk.args;

  blockedCallIds.add(toolCallId);

  const round = approvalContext?.round ?? 1;
  const maxRounds = approvalContext?.maxRounds ?? 10;
  if (round > maxRounds) {
    return;
  }

  const approval: PendingApproval = {
    approvalId: chunk.approvalId,
    toolCallId,
    toolName,
    serverName: toolSourceMap[toolName],
    serverId: approvalContext?.toolServerIdMap?.[toolName],
    args,
    reason: typeof chunk.reason === "string" ? chunk.reason : undefined,
    signature: typeof chunk.signature === "string" ? chunk.signature : "",
  };

  pendingApprovals.push(approval);
  await emit({
    type: "tool-approval-required",
    approvals: [...pendingApprovals],
    round,
  });
}

async function handleNonDeltaChunk(
  chunk: any,
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
  linkedSubagents: readonly Agent[] | undefined,
  parkedResults: Map<string, ParkedToolOutcome>,
  blockedCallIds: Set<string>,
  pendingApprovals: PendingApproval[],
  approvalContext?: StreamApprovalContext,
): Promise<void> {
  if (chunk.type === "tool-call") {
    await handleToolCallChunk(
      chunk,
      completedTools,
      toolSourceMap,
      emit,
      linkedSubagents,
      parkedResults,
    );
  } else if (chunk.type === "tool-result") {
    await handleToolResultChunk(
      chunk,
      completedTools,
      toolSourceMap,
      emit,
      parkedResults,
    );
  } else if (chunk.type === "tool-error") {
    await handleToolErrorChunk(chunk, completedTools, toolSourceMap, emit);
  } else if (chunk.type === "tool-output-denied") {
    await handleToolOutputDeniedChunk(
      chunk,
      completedTools,
      toolSourceMap,
      emit,
      parkedResults,
    );
  } else if (chunk.type === "tool-approval-request") {
    await handleToolApprovalRequestChunk(
      chunk,
      toolSourceMap,
      emit,
      blockedCallIds,
      pendingApprovals,
      approvalContext,
    );
  } else if (chunk.type === "error") {
    const appErr = toAppError(chunk.error);
    await emit({ type: "error", message: appErr.message, code: appErr.code });
  }
}

/**
 * Consumes chunks from a model stream, emits realtime events, and tracks completed tools.
 *
 * @param fullStream - Target full stream
 * @param abortSignal - Target abort signal
 * @param emit - Target emit
 * @param toolSourceMap - Target tool source map
 * @param completedTools - Target completed tools
 * @returns The resolved result
 * @author Maruf Bepary
 */
/**
 * Internal state for delta streaming buffering and rate-limiting.
 */
interface DeltaStreamContext {
  accumulatedText: string;
  accumulatedReasoning: string;
  bufferedText: string;
  bufferedReasoning: string;
  lastTextFlushTime: number;
  lastReasoningFlushTime: number;
  flushReasoning: () => Promise<void>;
  flushText: () => Promise<void>;
  flushDeltas: () => Promise<void>;
}

/**
 * Handles text delta chunks, flushing pending reasoning and coalescing output text.
 *
 * @param chunkText - Text delta chunk from model stream
 * @param ctx - Delta streaming context state
 * @author Maruf Bepary
 */
async function handleStreamTextDelta(
  chunkText: string,
  ctx: DeltaStreamContext,
): Promise<void> {
  ctx.accumulatedText += chunkText;
  if (ctx.bufferedReasoning.length > 0) {
    await ctx.flushReasoning();
  }
  ctx.bufferedText += chunkText;
  if (Date.now() - ctx.lastTextFlushTime >= DELTA_COALESCE_INTERVAL_MS) {
    await ctx.flushText();
  }
}

/**
 * Handles reasoning delta chunks, flushing pending text and coalescing output reasoning.
 *
 * @param chunkText - Reasoning delta chunk from model stream
 * @param ctx - Delta streaming context state
 * @author Maruf Bepary
 */
async function handleStreamReasoningDelta(
  chunkText: string,
  ctx: DeltaStreamContext,
): Promise<void> {
  ctx.accumulatedReasoning += chunkText;
  if (ctx.bufferedText.length > 0) {
    await ctx.flushText();
  }
  ctx.bufferedReasoning += chunkText;
  if (Date.now() - ctx.lastReasoningFlushTime >= DELTA_COALESCE_INTERVAL_MS) {
    await ctx.flushReasoning();
  }
}

function finalizeCompletedToolApprovals(
  completedTools: CompletedToolRecord[],
  blockedCallIds: Set<string>,
): void {
  for (let i = completedTools.length - 1; i >= 0; i--) {
    if (blockedCallIds.has(completedTools[i]!.toolCallId)) {
      completedTools.splice(i, 1);
    }
  }
}

export async function consumeModelStream(
  fullStream: AsyncIterable<any>,
  abortSignal: AbortSignal,
  emit: (data: ChatStreamEvent) => Promise<void>,
  toolSourceMap: Record<string, string>,
  completedTools: CompletedToolRecord[],
  linkedSubagents?: readonly Agent[],
  approvalContext?: StreamApprovalContext,
): Promise<ConsumeModelStreamResult> {
  const flushReasoning = async (): Promise<void> => {
    if (ctx.bufferedReasoning.length === 0) return;
    const reasoningToEmit = ctx.bufferedReasoning;
    ctx.bufferedReasoning = "";
    ctx.lastReasoningFlushTime = Date.now();
    await emit({ type: "reasoning-delta", reasoning: reasoningToEmit });
  };

  const flushText = async (): Promise<void> => {
    if (ctx.bufferedText.length === 0) return;
    const textToEmit = ctx.bufferedText;
    ctx.bufferedText = "";
    ctx.lastTextFlushTime = Date.now();
    await emit({ type: "text-delta", text: textToEmit });
  };

  const flushDeltas = async (): Promise<void> => {
    await flushReasoning();
    await flushText();
  };

  const ctx: DeltaStreamContext = {
    accumulatedText: "",
    accumulatedReasoning: "",
    bufferedText: "",
    bufferedReasoning: "",
    lastTextFlushTime: 0,
    lastReasoningFlushTime: 0,
    flushReasoning,
    flushText,
    flushDeltas,
  };

  const inlineParser = createInlineReasoningParser();
  const parkedResults = new Map<string, ParkedToolOutcome>();
  const blockedCallIds = new Set<string>();
  const pendingApprovals: PendingApproval[] = [];

  for await (const chunk of fullStream) {
    if (abortSignal.aborted) {
      const flushed = inlineParser.flush();
      for (const part of flushed) {
        if (part.type === "reasoning") {
          await handleStreamReasoningDelta(part.text, ctx);
        } else {
          await handleStreamTextDelta(part.text, ctx);
        }
      }
      await ctx.flushDeltas();
      finalizeCompletedToolApprovals(completedTools, blockedCallIds);
      return {
        accumulatedText: ctx.accumulatedText,
        accumulatedReasoning: ctx.accumulatedReasoning,
        aborted: true,
        pendingApprovals,
      };
    }

    if (chunk.type === "text-delta") {
      const parts = inlineParser.push(chunk.text);
      for (const part of parts) {
        if (part.type === "reasoning") {
          await handleStreamReasoningDelta(part.text, ctx);
        } else {
          await handleStreamTextDelta(part.text, ctx);
        }
      }
    } else if (chunk.type === "reasoning-delta") {
      await handleStreamReasoningDelta(chunk.text, ctx);
    } else {
      const directReasoning = extractReasoningFromDelta(chunk);
      if (directReasoning) {
        await handleStreamReasoningDelta(directReasoning, ctx);
      } else {
        await ctx.flushDeltas();
        await handleNonDeltaChunk(
          chunk,
          completedTools,
          toolSourceMap,
          emit,
          linkedSubagents,
          parkedResults,
          blockedCallIds,
          pendingApprovals,
          approvalContext,
        );
      }
    }
  }

  const flushed = inlineParser.flush();
  for (const part of flushed) {
    if (part.type === "reasoning") {
      await handleStreamReasoningDelta(part.text, ctx);
    } else {
      await handleStreamTextDelta(part.text, ctx);
    }
  }

  await ctx.flushDeltas();
  finalizeCompletedToolApprovals(completedTools, blockedCallIds);

  return {
    accumulatedText: ctx.accumulatedText,
    accumulatedReasoning: ctx.accumulatedReasoning,
    aborted: false,
    pendingApprovals,
  };
}
