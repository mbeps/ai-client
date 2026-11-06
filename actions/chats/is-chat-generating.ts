"use server";

import { requireSession } from "@/lib/auth/require-session";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import { defineAction } from "@/lib/factories/define-action";
import { fetchUserInngestRuns } from "@/lib/inngest/run-service";
import { logger } from "@/lib/logger";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Checks whether an Inngest background generation job is currently running
 * or queued for the specified chat and authenticated user.
 *
 * Used on client mount/rejoin to determine if a stream should be re-attached
 * after a page refresh.
 *
 * Invariant: Never throws to caller. Offline, error, or empty runs list returns ok(false).
 *
 * @param chatId - Unique identifier of the chat session.
 * @returns Result containing boolean flag indicating if chat generation is active/queued.
 * @author Maruf Bepary
 */
export const isChatGenerating = defineAction(
  async (chatId: string): Promise<Result<boolean, CommonError>> => {
    try {
      const session = await requireSession();

      if (chatAbortRegistry.has(chatId)) {
        return ok(true);
      }

      const result = await fetchUserInngestRuns(session.user.id, {
        status: ["RUNNING", "QUEUED"],
        limit: 100,
      });

      if (!result.jobs || result.jobs.length === 0) {
        return ok(false);
      }

      return ok(
        result.jobs.some(
          (job) => job.type === "chat" && job.entityId === chatId,
        ),
      );
    } catch (err) {
      logger.warn("Failed to check if chat is generating", { chatId, err });
      return ok(false);
    }
  },
);
