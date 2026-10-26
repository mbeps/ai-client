import { inngest } from "@/lib/inngest/client";
import {
  cancelDevRun,
  fetchDevUserRuns,
} from "@/lib/inngest/run-service/dev-runs";
import {
  cancelProdRun,
  fetchProdUserRuns,
} from "@/lib/inngest/run-service/prod-runs";
import {
  HTTP_TIMEOUT_MS,
  isDevMode,
} from "@/lib/inngest/run-service/run-metadata";
import { getLogger, logger } from "@/lib/logger";
import type { JobStatus, ListJobsResult } from "@/types/jobs";

const log = getLogger(["inngest", "run-service"]);

/**
 * Fetches Inngest background job runs for a user with automatic offline resilience.
 *
 * Queries Inngest dev server via GraphQL or cloud REST API depending on environment.
 * Applies CEL expression filtering (`event.data.userId == "..."`) and application-level
 * user ownership checks. When Inngest is offline or unreachable, returns `{ jobs: [], offline: true }`
 * without throwing.
 *
 * @param userId Authenticated user ID.
 * @param options Optional status filter and pagination limit.
 * @returns Result object containing job items and offline flag.
 * @author Maruf Bepary
 */
export async function fetchUserInngestRuns(
  userId: string,
  options?: { status?: JobStatus[]; limit?: number },
): Promise<ListJobsResult> {
  try {
    logger.debug("Fetching Inngest runs for app", {
      appId: inngest.id,
      userId,
    });
    if (isDevMode()) {
      return await fetchDevUserRuns(userId, options);
    }
    return await fetchProdUserRuns(userId, options);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.warn("Inngest run service offline or unreachable: {error}", {
      error: errorMsg,
      userId,
    });
    return {
      jobs: [],
      offline: true,
      error: errorMsg,
    };
  }
}

/**
 * Cancels an Inngest background run for a user.
 *
 * Supports dev mode GraphQL mutation (`cancelRun`) and production REST API cancellation.
 * Gracefully handles already completed or cancelled runs by returning `{ success: true }`.
 * When Inngest is offline or unreachable, returns `{ success: false, error: ... }` without throwing.
 *
 * @param runId Inngest run ID.
 * @param userId Authenticated user ID requesting the cancellation.
 * @returns Success flag and optional error message.
 * @author Maruf Bepary
 */
export async function cancelInngestRun(
  runId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const signal = AbortSignal.timeout(HTTP_TIMEOUT_MS);
    if (isDevMode()) {
      return await cancelDevRun(runId, signal);
    }
    return await cancelProdRun(runId, signal);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.warn("Failed to cancel Inngest run: {error}", {
      error: errorMsg,
      runId,
      userId,
    });
    return {
      success: false,
      error: errorMsg,
    };
  }
}
