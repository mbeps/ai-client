import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
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
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  } | null;
}

interface CreateChatStreamOptions {
  result: StreamTextResult<any, any, any>;
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

  const startTime = Date.now();

  // Persist exactly once across all exit paths.
  let persisted = false;
  const persistOnce = async () => {
    if (persisted) return;
    persisted = true;
    await persistResultIn({
      result,
      finishRef,
      chatId,
      userId,
      userMessageId,
      resolvedModelId,
      assistantMessageId,
      startTime,
    });
  };

  // Client aborts don't reliably fire stream onFinish — hook the signal so
  // partial content is persisted (via the route's onAbort-populated finishRef)
  // and MCP connections are never leaked.
  abortSignal?.addEventListener(
    "abort",
    () => {
      // Yield to allow streamText.onAbort to populate finishRef.current
      setTimeout(() => {
        void persistOnce().finally(() => runCleanup());
      }, 0);
    },
    { once: true },
  );

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId: assistantMessageId } as any);
      // Stateless merge: the project writes its own `start` chunk carrying the
      // server-assigned message id, so the SDK must not emit a second one.
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          sendStart: false,
          messageMetadata: ({ part }) => {
            if (part.type === "finish") {
              return {
                usage: part.totalUsage,
                finishReason: part.finishReason,
              };
            }
            return undefined;
          },
        }),
      );
    },
    onError: (error) => {
      logger.error("[Chat Stream Error]", error, { chatId }, userId);
      if (isRateLimitError(error)) return normalizeRateLimitMessage(error);
      // Never leak raw provider/server errors to the client.
      return "An error occurred during generation.";
    },
    onEnd: async () => {
      await persistOnce();
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
async function persistResultIn(options: {
  result: StreamTextResult<any, any, any>;
  finishRef: FinishRef;
  chatId: string;
  userId: string;
  userMessageId?: string | null;
  resolvedModelId: string;
  assistantMessageId: string;
  startTime: number;
}): Promise<void> {
  const {
    result,
    finishRef,
    chatId,
    userId,
    userMessageId,
    resolvedModelId,
    assistantMessageId,
    startTime,
  } = options;

  let finish = finishRef.current;
  if (!finish) {
    // ponytail: awaits the full result even on client abort; acceptable
    // because persistence is best-effort and bounded by maxDuration.
    // SDK exposes PromiseLike (not Promise) — wrap for .catch support.
    // In AI SDK v7, top-level toolCalls/toolResults aggregate across all steps.
    const toPromise = <T>(p: PromiseLike<T>): Promise<T> => Promise.resolve(p);
    const [finalStep, toolCalls, toolResults, usage, finishReason] =
      await Promise.all([
        toPromise(result.finalStep).catch(() => undefined),
        toPromise(result.toolCalls).catch(() => []),
        toPromise(result.toolResults).catch(() => []),
        toPromise(result.usage).catch(() => undefined),
        toPromise(result.finishReason).catch(() => undefined),
      ]);
    finish = {
      text: finalStep?.text,
      reasoning: reasoningToString(finalStep?.reasoning),
      toolCalls: (toolCalls as unknown[]) ?? [],
      toolResults: (toolResults as unknown[]) ?? [],
      usage,
      finishReason,
    };
  }

  const hasTextOrReasoning = !!(finish.text || finish.reasoning);
  const hasToolCalls = (finish.toolCalls?.length ?? 0) > 0;
  if (!hasTextOrReasoning && !hasToolCalls) {
    logger.warn("[Chat Stream] No content to persist", { chatId });
    return;
  }

  const metadataObj: Record<string, any> = {};
  if ((finish.toolCalls?.length ?? 0) > 0) {
    metadataObj.toolCalls = (finish.toolCalls ?? []).map((tc: any) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: tc.args ?? tc.input,
    }));
    metadataObj.toolResults = (finish.toolResults ?? []).map((tr: any) => ({
      toolCallId: tr.toolCallId,
      toolName: tr.toolName,
      result: tr.result ?? tr.output,
    }));
  }
  if (finish.reasoning) metadataObj.reasoning = finish.reasoning;
  metadataObj.model = resolvedModelId;
  if (finish.finishReason) metadataObj.finishReason = finish.finishReason;
  if (finish.usage) metadataObj.usage = finish.usage;
  metadataObj.durationMs = Date.now() - startTime;

  try {
    await persistAssistantResponse({
      chatId,
      assistantMessageId,
      content: finish.text ?? "",
      parentId: userMessageId ?? undefined,
      metadata:
        Object.keys(metadataObj).length > 0
          ? JSON.stringify(metadataObj)
          : null,
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
