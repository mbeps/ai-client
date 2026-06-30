import { logger } from "@/lib/logger";
import { ToolCallEntry } from "@/types/chat/tool-call";
import { ToolResultEntry } from "@/types/chat/tool-result";
import { StreamState } from "@/types/chat/stream-state";
import { StreamChunk } from "@/types/chat/stream-chunk";
import { StreamChunkResult } from "@/types/chat/stream-chunk-result";

/**
 * Processes a single SSE chunk from the Vercel AI SDK's `fullStream` and
 * returns both the SSE data to enqueue and any state that should be
 * accumulated.
 *
 * **This is a pure function** — it does not call `controller.enqueue` or
 * mutate external state. The caller is responsible for those concerns.
 *
 * @param chunk  The raw chunk from `result.fullStream`
 * @param state  The current accumulated state
 * @param meta   Optional metadata used only for logging (chatId, userId, toolSourceMap)
 */
export function handleStreamChunk(
  chunk: StreamChunk,
  state: StreamState,
  meta?: {
    chatId?: string;
    userId?: string;
    toolSourceMap?: Record<string, string>;
  },
): StreamChunkResult {
  switch (chunk.type) {
    case "text-delta":
      return {
        ssePayload: { type: "text", delta: chunk.text },
        stateUpdates: { fullText: state.fullText + chunk.text },
      };

    case "reasoning-delta":
      return {
        ssePayload: { type: "reasoning", delta: chunk.text },
        stateUpdates: { fullReasoning: state.fullReasoning + chunk.text },
      };

    case "tool-call": {
      const serverName = meta?.toolSourceMap?.[chunk.toolName];
      logger.info(
        "[Chat API] Tool call initiated",
        {
          chatId: meta?.chatId,
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          args: chunk.input,
          serverName,
        },
        meta?.userId,
      );
      const newEntry: ToolCallEntry = {
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        args: chunk.input,
        serverName,
      };
      return {
        ssePayload: {
          type: "tool-call",
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          args: chunk.input,
          serverName,
        },
        stateUpdates: { toolCalls: [...state.toolCalls, newEntry] },
      };
    }

    case "tool-result": {
      logger.info(
        "[Chat API] Tool result received",
        {
          chatId: meta?.chatId,
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
        },
        meta?.userId,
      );
      const newEntry: ToolResultEntry = {
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        result: chunk.output,
      };
      return {
        ssePayload: {
          type: "tool-result",
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          result: chunk.output,
        },
        stateUpdates: { toolResults: [...state.toolResults, newEntry] },
      };
    }

    case "error":
      return {
        ssePayload: {
          type: "error",
          message: String(chunk.error),
        },
        stateUpdates: {},
      };

    default:
      return { ssePayload: null, stateUpdates: {} };
  }
}
