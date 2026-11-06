"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { abortChatStream } from "@/lib/chat/abort-chat-stream";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { cancelInngestRun } from "@/lib/inngest/run-service";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Options for cancelling an Inngest background job run with dual-layer abort.
 */
export interface CancelJobOptions {
  /** Optional chat ID to abort in-memory streaming and dispatch `chat/response.cancel`. */
  chatId?: string;
  /** Optional transform run ID to mark failed in DB. */
  transformRunId?: string;
}

/**
 * Server Action that cancels an Inngest background job run with dual-layer abort semantics.
 *
 * Invokes `cancelInngestRun` to cancel the run via Inngest's GraphQL dev endpoint or production REST API.
 * In addition, executes immediate application-layer cancellation:
 * - If `chatId` is provided: triggers `chatAbortRegistry.abort(chatId)` to terminate the in-memory
 *   HTTP connection to the LLM provider in <1ms, and broadcasts `chat/response.cancel` via Inngest.
 * - If `transformRunId` is provided: updates the `transformRun` database record to `status: "failed"`
 *   with errorMessage "Cancelled by user".
 *
 * @param runId Inngest run identifier to cancel.
 * @param options Contextual entity IDs for dual-layer cancellation.
 * @returns Result object indicating whether cancellation was successful.
 * @author Maruf Bepary
 */
export const cancelJob = defineAction(
  async (
    runId: string,
    options?: CancelJobOptions,
  ): Promise<Result<{ success: boolean }, CommonError>> => {
    const session = await requireSession();

    const parsed = z.string().min(1).safeParse(runId);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid runId",
      });
    }
    const validatedId = parsed.data;
    const userId = session.user.id;

    // 1. If this is a chat job, abort the active stream gracefully via abortChatStream.
    if (options?.chatId) {
      await abortChatStream(options.chatId, userId);
      if (!options.transformRunId) {
        return ok({ success: true });
      }
    }

    // 2. If this is a transform run, update DB record to failed
    if (options?.transformRunId) {
      await db
        .update(transformRun)
        .set({
          status: "failed",
          errorMessage: "Cancelled by user",
        })
        .where(
          and(
            eq(transformRun.id, options.transformRunId),
            eq(transformRun.userId, userId),
          ),
        );
    }

    // 3. For non-chat jobs (e.g. transform, translation, or generic Inngest runs),
    // cancel via Inngest run cancellation API.
    const cancelResult = await cancelInngestRun(validatedId, userId);
    if (!cancelResult.success) {
      return fail({
        code: ERROR_CODE.INTERNAL,
        message: cancelResult.error || "Failed to cancel run",
        ref: "inngest-cancel",
      });
    }

    return ok({ success: true });
  },
);
