import { INTERNAL_TOOL_IDS } from "@/config/tools";
import type { ChatStreamEvent, chatChannel } from "@/lib/inngest/chat-channel";
import type {
  CompletedToolRecord,
  ConsumeModelStreamResult,
} from "@/lib/inngest/chat-response/chat-response-types";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { sanitizeSubagentOutput } from "@/lib/subagents/subagent-dispatch-tool";

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
 *
 * @param chunk - Target chunk
 * @param completedTools - Target completed tools
 * @param toolSourceMap - Target tool source map
 * @param emit - Target emit
 * @returns The resolved result
 * @author Maruf Bepary
 */
async function handleToolCallChunk(
  chunk: any,
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
): Promise<void> {
  const serverName = toolSourceMap[chunk.toolName];
  const args = chunk.args ?? chunk.input;
  completedTools.push({
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    args,
    serverName,
  });
  await emit({
    type: "tool-call",
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    args,
    serverName,
  });
}

/**
 * Handles a tool-result chunk by sanitizing output and emitting event.
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
): Promise<void> {
  const isPreliminary = Boolean(chunk.preliminary);
  const rawResult = chunk.result ?? chunk.output;
  const tc = completedTools.find((t) => t.toolCallId === chunk.toolCallId);
  const isSubagent =
    chunk.toolName === "delegate_task" ||
    chunk.toolName === INTERNAL_TOOL_IDS.DELEGATE_TASK;
  const finalResult = isSubagent
    ? sanitizeSubagentOutput(rawResult)
    : rawResult;

  if (tc && !isPreliminary) {
    tc.result = finalResult;
  }
  const serverName = tc?.serverName ?? toolSourceMap[chunk.toolName];
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
async function handleNonDeltaChunk(
  chunk: any,
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
): Promise<void> {
  if (chunk.type === "tool-call") {
    await handleToolCallChunk(chunk, completedTools, toolSourceMap, emit);
  } else if (chunk.type === "tool-result") {
    await handleToolResultChunk(chunk, completedTools, toolSourceMap, emit);
  } else if (chunk.type === "tool-error") {
    await handleToolErrorChunk(chunk, completedTools, toolSourceMap, emit);
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

export async function consumeModelStream(
  fullStream: AsyncIterable<any>,
  abortSignal: AbortSignal,
  emit: (data: ChatStreamEvent) => Promise<void>,
  toolSourceMap: Record<string, string>,
  completedTools: CompletedToolRecord[],
): Promise<ConsumeModelStreamResult> {
  const ctx: DeltaStreamContext = {
    accumulatedText: "",
    accumulatedReasoning: "",
    bufferedText: "",
    bufferedReasoning: "",
    lastTextFlushTime: 0,
    lastReasoningFlushTime: 0,
    flushReasoning: async () => {},
    flushText: async () => {},
    flushDeltas: async () => {},
  };

  ctx.flushReasoning = async (): Promise<void> => {
    if (ctx.bufferedReasoning.length === 0) return;
    const reasoningToEmit = ctx.bufferedReasoning;
    ctx.bufferedReasoning = "";
    ctx.lastReasoningFlushTime = Date.now();
    await emit({ type: "reasoning-delta", reasoning: reasoningToEmit });
  };

  ctx.flushText = async (): Promise<void> => {
    if (ctx.bufferedText.length === 0) return;
    const textToEmit = ctx.bufferedText;
    ctx.bufferedText = "";
    ctx.lastTextFlushTime = Date.now();
    await emit({ type: "text-delta", text: textToEmit });
  };

  ctx.flushDeltas = async (): Promise<void> => {
    await ctx.flushReasoning();
    await ctx.flushText();
  };

  for await (const chunk of fullStream) {
    if (abortSignal.aborted) {
      await ctx.flushDeltas();
      return {
        accumulatedText: ctx.accumulatedText,
        accumulatedReasoning: ctx.accumulatedReasoning,
        aborted: true,
      };
    }

    if (chunk.type === "text-delta") {
      await handleStreamTextDelta(chunk.text, ctx);
    } else if (chunk.type === "reasoning-delta") {
      await handleStreamReasoningDelta(chunk.text, ctx);
    } else {
      await ctx.flushDeltas();
      await handleNonDeltaChunk(chunk, completedTools, toolSourceMap, emit);
    }
  }

  await ctx.flushDeltas();

  return {
    accumulatedText: ctx.accumulatedText,
    accumulatedReasoning: ctx.accumulatedReasoning,
    aborted: false,
  };
}
