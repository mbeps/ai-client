import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Tool call entry extracted from streaming response.
 * @author Maruf Bepary
 */
export interface ToolCallEntry {
  toolCallId: string;
  toolName: string;
  args: unknown;
  serverName?: string;
}

export interface ToolResultEntry {
  toolCallId: string;
  toolName: string;
  result: unknown;
}

export interface StreamState {
  fullText: string;
  fullReasoning: string;
  toolCalls: ToolCallEntry[];
  toolResults: ToolResultEntry[];
}

/** The shape of a single SSE event produced by `result.fullStream`. */
export type StreamChunk =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      output: unknown;
    }
  | { type: "reasoning-delta"; text: string }
  | { type: "error"; error: unknown };

export interface StreamChunkResult {
  /** SSE-payload to enqueue, or `null` when nothing should be sent */
  ssePayload: Record<string, unknown> | null;
  /** Partial state updates to merge into the accumulator */
  stateUpdates: Partial<StreamState>;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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
