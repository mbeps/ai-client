"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { abortChatStream } from "@/lib/chat/abort-chat-stream";
import { inngest } from "@/lib/inngest/client";
import { cancelInngestRun } from "@/lib/inngest/run-service";

/**
 * Options for cancelling an Inngest background job run with dual-layer abort.
 */
export interface CancelJobOptions {
  /** Optional chat ID to abort in-memory streaming and dispatch `chat/response.cancel`. */
  chatId?: string;
  /** Optional transform run ID to mark failed in DB and dispatch `workflows/transform.cancel`. */
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
 *   with errorMessage "Cancelled by user", and broadcasts `workflows/transform.cancel` via Inngest.
 *
 * @param runId Inngest run identifier to cancel.
 * @param options Contextual entity IDs for dual-layer cancellation.
 * @returns Result object indicating whether cancellation was successful.
 * @throws {Error} "Unauthorized" if no authenticated session exists.
 * @author Maruf Bepary
 */
export async function cancelJob(
  runId: string,
  options?: CancelJobOptions,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;

  // 1. If this is a chat job, abort the active stream gracefully via abortChatStream.
  // The in-memory stream aborts, generateChatResponse cleans up MCP tools and exits cleanly with HTTP 200,
  // causing Inngest to mark the run as COMPLETED (identical to pressing the Stop button in the chat interface).
  // We do not invoke cancelInngestRun for chats, preserving consistent COMPLETED status and avoiding retries.
  if (options?.chatId) {
    await abortChatStream(options.chatId, userId);
    if (!options.transformRunId) {
      return { success: true };
    }
  }

  // 2. If this is a transform run, update DB record and broadcast event
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

    await inngest.send({
      name: "workflows/transform.cancel",
      data: {
        runId: options.transformRunId,
        userId,
      },
    });
  }

  // 3. For non-chat jobs (e.g. transform, translation, or generic Inngest runs),
  // cancel via Inngest run cancellation API.
  const cancelResult = await cancelInngestRun(runId, userId);
  if (!cancelResult.success) {
    return { success: false, error: cancelResult.error };
  }

  return { success: true };
}

/**
 * Server Action alias for cancelJob.
 */
export async function cancelJobAction(
  runId: string,
  options?: CancelJobOptions,
): Promise<{ success: boolean; error?: string }> {
  return cancelJob(runId, options);
}
