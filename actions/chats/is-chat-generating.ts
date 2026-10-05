"use server";

import { requireSession } from "@/lib/auth/require-session";
import { fetchUserInngestRuns } from "@/lib/inngest/run-service";
import { logger } from "@/lib/logger";

/**
 * Checks whether an Inngest background generation job is currently running
 * or queued for the specified chat and authenticated user.
 *
 * Used on client mount/rejoin to determine if a stream should be re-attached
 * after a page refresh.
 *
 * Invariant: Never throws to caller. Offline, error, or empty runs list returns false.
 *
 * @param chatId - Unique identifier of the chat session.
 * @returns True if a chat generation job is active/queued for this chat; false otherwise.
 * @author Maruf Bepary
 */
export async function isChatGenerating(chatId: string): Promise<boolean> {
  try {
    const session = await requireSession();
    const result = await fetchUserInngestRuns(session.user.id, {
      status: ["RUNNING", "QUEUED"],
      limit: 20,
    });

    if (!result.jobs || result.jobs.length === 0) {
      return false;
    }

    return result.jobs.some(
      (job) => job.type === "chat" && job.entityId === chatId,
    );
  } catch (err) {
    logger.warn("Failed to check if chat is generating", { chatId, err });
    return false;
  }
}
