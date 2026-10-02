import type { StreamTextResult, ToolSet } from "ai";
import type { ChatStreamEvent } from "@/lib/inngest/channels";
import { getLogger } from "@/lib/logger";
import type { PendingApproval } from "@/types/tool/approval";

const log = getLogger(["inngest", "chat", "response"]);

/**
 * Marker the UI keys off. A denial reaches history as a plain tool result, so
 * the model can read it and change course instead of seeing a dropped call.
 */
const DENIED_RESULT = "Denied by user";

/** Mutable accumulator for one tool call inside the stream loop. */
export interface CallAccumulator {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
}

/** Everything one round of streaming accumulates, mutated in place. */
export interface StreamAccumulator {
  content: string;
  reasoning: string;
  calls: CallAccumulator[];
  blockedCallIds: Set<string>;
  approvals: PendingApproval[];
}

/** Per-round policy the loop needs but does not own. */
export interface CollectStreamRoundOptions {
  abortSignal: AbortSignal;
  chatId: string;
  /** 1-based approval round this stream belongs to. */
  round: number;
  /** True once the caller has spent every approval round it is allowed. */
  roundCapped: boolean;
}

/** The slice of the SDK result the loop reads. Keeps the test seam narrow. */
type StreamTextStream = Pick<
  StreamTextResult<ToolSet, never, never>,
  "fullStream"
>;

/**
 * Attaches an outcome to its call, or parks it until the call arrives.
 *
 * Verified against ai@7.0.106: answering a `tool-approval-response` makes the
 * SDK execute the approved tool before the model produces anything, so
 * `tool-result` arrives ahead of the `tool-call` chunk that describes it. A
 * plain lookup would therefore miss and the outcome of an approved tool would
 * be lost from persisted metadata, so an early outcome is held until its call
 * shows up. An outcome whose call never arrives stays parked and is carried by
 * the emitted event only, because history cannot represent it.
 *
 * @param calls - Accumulator call list, mutated in place.
 * @param parked - Outcomes seen before their call, mutated in place.
 * @param toolCallId - Id of the call the outcome belongs to.
 * @param result - Output, error payload, or denial marker.
 * @author Maruf Bepary
 */
function recordCallResult(
  calls: CallAccumulator[],
  parked: Map<string, unknown>,
  toolCallId: string,
  result: unknown,
): void {
  const call = calls.find((c) => c.toolCallId === toolCallId);
  if (call) {
    call.result = result;
    return;
  }
  parked.set(toolCallId, result);
}

/**
 * Drains one `streamText` full stream into the accumulator, emitting every
 * event as it goes.
 *
 * It owns the loop and nothing else. The caller keeps the round decision
 * (`done` versus `awaiting-approval`) because that needs `usage` and
 * `finishReason`, which are only safe to read after the stream is drained.
 *
 * @param result - The SDK result to drain.
 * @param accumulator - Mutated in place and returned for convenience.
 * @param emit - Sink for realtime events.
 * @param options - Abort signal, chat id, round number, and cap flag.
 * @returns The accumulator, or early with the abort flag set when the caller
 *   aborted mid-stream.
 * @author Maruf Bepary
 */
export async function collectStreamRound(
  result: StreamTextStream,
  accumulator: StreamAccumulator,
  emit: (event: ChatStreamEvent) => Promise<void>,
  options: CollectStreamRoundOptions,
): Promise<{ aborted: boolean }> {
  const { abortSignal, chatId, round, roundCapped } = options;
  // Strings are copied on destructure, so the accumulator fields are read and
  // written through the object itself.
  const { calls, blockedCallIds, approvals } = accumulator;
  // Outcomes that arrived before the call chunk that describes them.
  const parked = new Map<string, unknown>();

  for await (const chunk of result.fullStream) {
    if (abortSignal.aborted) {
      log.info("Stream loop aborted by user (chatId: {chatId})", { chatId });
      return { aborted: true };
    }
    if (chunk.type === "text-delta") {
      accumulator.content += chunk.text;
      await emit({ type: "text-delta", text: chunk.text });
    } else if (chunk.type === "reasoning-delta") {
      accumulator.reasoning += chunk.text;
      await emit({ type: "reasoning-delta", reasoning: chunk.text });
    } else if (chunk.type === "tool-call") {
      // V4 renamed `input` from `args`, so both are read in case a provider or
      // a replayed part still carries the old name.
      const legacy = chunk as { args?: unknown; input?: unknown };
      const args = legacy.args ?? legacy.input;
      const call: CallAccumulator = {
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        args,
      };
      // The round may already hold this call's outcome, because a resume runs
      // the approved tool before the model emits anything.
      const early = parked.get(chunk.toolCallId);
      if (early !== undefined) {
        call.result = early;
        parked.delete(chunk.toolCallId);
      }
      calls.push(call);
      await emit({
        type: "tool-call",
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        args,
      });
    } else if (chunk.type === "tool-approval-request") {
      // Verified against ai@7.0.106: the streamed part nests the whole tool
      // call and carries no toolCallId of its own. Only the resume message
      // part uses a flat toolCallId (V4).
      //
      // A resume re-emits the request with `isAutomatic: true` as a record of
      // the decision it already applied, and the tool has already run by then.
      // Marking that call blocked again would make `settled()` discard its
      // result, so an automatic request is recorded and otherwise ignored.
      if (chunk.isAutomatic === true) continue;
      blockedCallIds.add(chunk.toolCall.toolCallId);
      if (roundCapped) {
        log.warn(
          "Approval round cap reached, finishing without further gates (chatId: {chatId})",
          { chatId },
        );
        continue;
      }
      approvals.push({
        approvalId: chunk.approvalId,
        toolCallId: chunk.toolCall.toolCallId,
        toolName: chunk.toolCall.toolName,
        args: chunk.toolCall.input,
        reason: chunk.reason,
        signature: chunk.signature ?? "",
      });
      await emit({
        type: "tool-approval-required",
        approvals: [...approvals],
        round,
      });
    } else if (chunk.type === "tool-output-denied") {
      // Verified shape: { type, toolCallId, toolName }. The SDK runs nothing
      // for a denial, so history needs a result the model can read.
      const value = { error: DENIED_RESULT };
      recordCallResult(calls, parked, chunk.toolCallId, value);
      await emit({
        type: "tool-result",
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        result: value,
      });
    } else if (chunk.type === "tool-result") {
      // Same V4 rename as the tool-call branch: `output` is the current name.
      const legacy = chunk as { result?: unknown; output?: unknown };
      const value = legacy.result ?? legacy.output;
      recordCallResult(calls, parked, chunk.toolCallId, value);
      await emit({
        type: "tool-result",
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        result: value,
      });
    } else if (chunk.type === "tool-error") {
      const raw: unknown = chunk.error;
      const message =
        raw instanceof Error
          ? raw.message
          : typeof raw === "string"
            ? raw
            : "Tool execution failed";
      const value = { error: message };
      recordCallResult(calls, parked, chunk.toolCallId, value);
      await emit({
        type: "tool-result",
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        result: value,
      });
    }
  }

  return { aborted: false };
}
