"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { workflowRun } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { abortChatStream } from "@/lib/chat/abort-chat-stream";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
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
  /** Optional workflow run ID to mark failed in DB and emit cancellation. */
  workflowRunId?: string;
}

/**
 * Server Action that cancels an Inngest background job run with dual-layer abort semantics.
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
      if (!options.workflowRunId) {
        return ok({ success: true });
      }
    }

    // 2. If this is a workflow run, verify ownership via owner-scoped update before emitting cancel event
    if (options?.workflowRunId) {
      const cancelledRows = await db
        .update(workflowRun)
        .set({
          status: "failed",
          errorMessage: "Cancelled by user",
        })
        .where(
          and(
            eq(workflowRun.id, options.workflowRunId),
            eq(workflowRun.userId, userId),
          ),
        )
        .returning({ id: workflowRun.id });

      if (cancelledRows.length === 0) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Workflow run not found",
        });
      }

      await inngest.send({
        name: "workflows/run.cancel",
        data: { runId: options.workflowRunId },
      });
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
