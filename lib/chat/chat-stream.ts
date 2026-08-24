import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type StreamTextResult,
} from "ai";
import { logger } from "@/lib/logger";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";
import { persistAssistantResponse } from "@/lib/chat/persist-response";

/**
 * Mutable holder the route's `streamText({ onFinish })` callback populates with
 * accumulated generation data. `createChatStream` persists from it when the UI
 * message stream finishes.
 * @author Maruf Bepary
 */
export interface FinishRef {
  current: {
    text?: string;
    reasoning?: string;
    toolCalls?: unknown[];
    toolResults?: unknown[];
    finishReason?: string;
  } | null;
}

interface CreateChatStreamOptions {
  result: StreamTextResult<any, any>;
  chatId: string;
  userId: string;
  userMessageId?: string | null;
  resolvedModelId: string;
  assistantMessageId?: string;
  mcpCleanup?: () => Promise<void>;
  finishRef: FinishRef;
  abortSignal?: AbortSignal;
}

/**
 * Normalises SDK reasoning output (string or parts array) to a plain string.
 * @author Maruf Bepary
 */
function reasoningToString(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map((p) => (p as any).text ?? "").join("");
  return "";
}

/**
 * Wraps a `streamText` result in an AI SDK UI message stream response.
 *
 * - Emits a `start` chunk carrying the server-assigned assistant message id so
 *   the client and DB agree on the id.
 * - Persists the assistant response (best-effort) once the stream finishes,
 *   using data accumulated by the route's `streamText.onFinish` into `finishRef`.
 * - Runs MCP cleanup exactly once across all exit paths: success, error, and
 *   client abort.
 *
 * @author Maruf Bepary
 * @see {@link lib/chat/persist-response} for persistence details
 */
export function createChatStream(options: CreateChatStreamOptions): Response {
  const {
    result,
    chatId,
    userId,
    userMessageId,
    resolvedModelId,
    assistantMessageId = crypto.randomUUID(),
    mcpCleanup,
    finishRef,
    abortSignal,
  } = options;

  let cleanupDone = false;
  const runCleanup = async () => {
    if (!cleanupDone) {
      cleanupDone = true;
      await mcpCleanup?.();
    }
  };

  // Client aborts don't reliably fire stream onFinish — hook the signal so
  // MCP connections are never leaked. ponytail: relies on abortSignal being
  // wired to req.signal; upgrade path: SDK-level onAbort callback if added.
  abortSignal?.addEventListener("abort", () => void runCleanup(), {
    once: true,
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId: assistantMessageId } as any);
      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      logger.error("[Chat Stream Error]", error, { chatId }, userId);
      if (isRateLimitError(error)) return normalizeRateLimitMessage(error);
      // Never leak raw provider/server errors to the client.
      return "An error occurred during generation.";
    },
    onFinish: async () => {
      await persistResultIn({
        result,
        finishRef,
        chatId,
        userId,
        userMessageId,
        resolvedModelId,
        assistantMessageId,
      });
      await runCleanup();
    },
  });

  return createUIMessageStreamResponse({ stream });
}

/**
 * Persists the completed response. Reads the route's `streamText.onFinish`
 * data via `finishRef`, falling back to awaiting the SDK's own promise
 * properties — this removes any ordering dependency between the two finish
 * callbacks (the ref may not be populated yet when the UI stream finishes).
 * @author Maruf Bepary
 */
async function persistResultIn(
  options: {
    result: StreamTextResult<any, any>;
    finishRef: FinishRef;
    chatId: string;
    userId: string;
    userMessageId?: string | null;
    resolvedModelId: string;
    assistantMessageId: string;
  },
): Promise<void> {
  const { result, finishRef, chatId, userId, userMessageId, resolvedModelId, assistantMessageId } = options;

  let finish = finishRef.current;
  if (!finish || (!finish.text && !finish.reasoning)) {
    // ponytail: awaits the full result even on client abort; acceptable
    // because persistence is best-effort and bounded by maxDuration.
    // SDK exposes PromiseLike (not Promise) — wrap for .catch support
    const toPromise = <T,>(p: PromiseLike<T>): Promise<T> => Promise.resolve(p);
    const [text, reasoning, toolCalls, toolResults] = await Promise.all([
      toPromise(result.text).catch(() => undefined),
      toPromise(result.reasoning).catch(() => undefined),
      toPromise(result.toolCalls).catch(() => []),
      toPromise(result.toolResults).catch(() => []),
    ]);
    finish = {
      text,
      reasoning: reasoningToString(reasoning),
      toolCalls: toolCalls as unknown[],
      toolResults: toolResults as unknown[],
    };
  }

  if (!finish.text && !finish.reasoning) {
    logger.warn("[Chat Stream] No content to persist", { chatId });
    return;
  }

  const metadataObj: Record<string, any> = {};
  if ((finish.toolCalls?.length ?? 0) > 0) {
    metadataObj.toolCalls = finish.toolCalls;
    metadataObj.toolResults = finish.toolResults;
  }
  if (finish.reasoning) metadataObj.reasoning = finish.reasoning;
  metadataObj.model = resolvedModelId;

  try {
    await persistAssistantResponse({
      chatId,
      assistantMessageId,
      content: finish.text ?? "",
      parentId: userMessageId ?? undefined,
      metadata:
        Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : null,
    });
    logger.info(
      "[Chat Stream] Response completed",
      {
        chatId,
        assistantMessageId,
        textLength: (finish.text ?? "").length,
        toolCallsCount: finish.toolCalls?.length ?? 0,
      },
      userId,
    );
  } catch (err) {
    // Best-effort: the stream is already delivered to the client; a failed DB
    // write must not break the response. Logged for operator action.
    logger.error("[Chat Stream] Failed to persist response", err, { chatId });
  }
}
