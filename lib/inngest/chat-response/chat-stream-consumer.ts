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
 * Consumes chunks from a model stream, emits realtime events, and tracks completed tools.
 * @author Maruf Bepary
 */
export async function consumeModelStream(
  fullStream: AsyncIterable<any>,
  abortSignal: AbortSignal,
  emit: (data: ChatStreamEvent) => Promise<void>,
  toolSourceMap: Record<string, string>,
  completedTools: CompletedToolRecord[],
): Promise<ConsumeModelStreamResult> {
  let accumulatedText = "";
  let accumulatedReasoning = "";

  for await (const chunk of fullStream) {
    if (abortSignal.aborted) {
      return { accumulatedText, accumulatedReasoning, aborted: true };
    }

    if (chunk.type === "text-delta") {
      accumulatedText += chunk.text;
      await emit({ type: "text-delta", text: chunk.text });
    } else if (chunk.type === "reasoning-delta") {
      accumulatedReasoning += chunk.text;
      await emit({ type: "reasoning-delta", reasoning: chunk.text });
    } else if (chunk.type === "tool-call") {
      await handleToolCallChunk(chunk, completedTools, toolSourceMap, emit);
    } else if (chunk.type === "tool-result") {
      await handleToolResultChunk(chunk, completedTools, toolSourceMap, emit);
    } else if (chunk.type === "tool-error") {
      await handleToolErrorChunk(chunk, completedTools, toolSourceMap, emit);
    }
  }

  return { accumulatedText, accumulatedReasoning, aborted: false };
}
