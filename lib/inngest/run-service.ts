import { inngest } from "@/lib/inngest/client";
import {
  computeDurationMs,
  extractErrorMessage,
  extractInlinePayloadData,
  extractTriggerEventId,
  HTTP_TIMEOUT_MS,
  isAlreadyEndedError,
  isMismatchedUser,
  normalizeRunFields,
  resolveInngestApiBaseUrl,
  resolveInngestHeaders,
  resolveJobMetadata,
  resolveJobType,
} from "@/lib/inngest/run-service/run-metadata";
import { getLogger, logger } from "@/lib/logger";
import type { JobItem, JobStatus, ListJobsResult } from "@/types/jobs";

const log = getLogger(["inngest", "run-service"]);

/**
 * Fetches triggering event payload data from Inngest when inline trigger data is absent.
 * Deduplicates in-flight requests per eventId within a batch.
 *
 * @param baseUrl - Inngest API base URL
 * @param eventId - Target event ULID
 * @param headers - HTTP headers
 * @param signal - AbortSignal
 * @param cache - Map caching promises per eventId
 * @returns Event payload data and name, or null on failure
 * @author Maruf Bepary
 */
async function fetchEventPayload(
  baseUrl: string,
  eventId: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  cache: Map<
    string,
    Promise<{ data?: Record<string, any>; name?: string } | null>
  >,
): Promise<{ data?: Record<string, any>; name?: string } | null> {
  const cached = cache.get(eventId);
  if (cached) return cached;

  const fetchPromise = (async () => {
    try {
      const res = await fetch(`${baseUrl}/v1/events/${eventId}`, {
        headers,
        signal,
      });
      if (!res.ok) return null;
      const body = await res.json();
      const eventData = body?.data;
      if (!eventData || typeof eventData !== "object") return null;
      return {
        data: eventData.data,
        name: eventData.name,
      };
    } catch (err) {
      log.debug("Failed to fetch event payload for event {eventId}: {error}", {
        eventId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  })();

  cache.set(eventId, fetchPromise);
  return fetchPromise;
}

/**
 * Resolves run event payload data, either from inline run properties or via fallback fetch.
 *
 * @param run - Raw run record from Inngest
 * @param baseUrl - Inngest API base URL
 * @param headers - HTTP headers
 * @param signal - AbortSignal
 * @param eventCache - In-flight event promise cache
 * @returns Object containing resolved payload data and optional fallback event name
 * @author Maruf Bepary
 */
export async function resolveRunEventData(
  run: Record<string, any>,
  baseUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  eventCache: Map<
    string,
    Promise<{ data?: Record<string, any>; name?: string } | null>
  > = new Map(),
): Promise<{ payloadData?: Record<string, any>; eventNameFallback?: string }> {
  let payloadData = extractInlinePayloadData(run);
  let eventNameFallback: string | undefined;

  if (!payloadData) {
    const eventId = extractTriggerEventId(run);
    if (eventId) {
      const eventResult = await fetchEventPayload(
        baseUrl,
        eventId,
        headers,
        signal,
        eventCache,
      );
      if (eventResult?.data) {
        payloadData = eventResult.data;
      }
      if (eventResult?.name) {
        eventNameFallback = eventResult.name;
      }
    }
  }

  return { payloadData, eventNameFallback };
}

/**
 * Constructs the Inngest v2 runs query URL with CEL expression filtering.
 *
 * @param baseUrl - Normalized Inngest API base URL
 * @param userId - Target user identifier
 * @param options - Optional status and limit filters
 * @returns Fully constructed URL
 * @author Maruf Bepary
 */
function buildRunsUrl(
  baseUrl: string,
  userId: string,
  options?: { status?: JobStatus[]; limit?: number },
): URL {
  const url = new URL(`${baseUrl}/v2/runs`);
  url.searchParams.set("query", `event.data.userId == "${userId}"`);
  url.searchParams.set("limit", String(options?.limit ?? 20));

  if (options?.status && options.status.length > 0) {
    for (const s of options.status) {
      url.searchParams.append("status", s);
    }
  }

  return url;
}

/**
 * Normalizes an Inngest run and constructs a JobItem, verifying user tenant boundaries.
 *
 * @param run - Raw run record from Inngest
 * @param baseUrl - Inngest API base URL
 * @param userId - Requesting user identifier
 * @param headers - Request headers
 * @param signal - AbortSignal
 * @param eventCache - In-flight event promise cache
 * @returns JobItem or null if mismatched/invalid
 * @author Maruf Bepary
 */
async function buildJobItem(
  run: Record<string, any>,
  baseUrl: string,
  userId: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  eventCache: Map<
    string,
    Promise<{ data?: Record<string, any>; name?: string } | null>
  >,
): Promise<JobItem | null> {
  const { payloadData, eventNameFallback } = await resolveRunEventData(
    run,
    baseUrl,
    headers,
    signal,
    eventCache,
  );

  const norm = normalizeRunFields(run, payloadData, eventNameFallback);

  if (isMismatchedUser(norm.payloadData, userId)) {
    return null;
  }

  const jobType = resolveJobType(norm.eventName);
  const metadata = resolveJobMetadata(
    jobType,
    norm.eventName,
    norm.functionName,
    norm.payloadData,
  );

  return {
    id: run.id,
    functionId: norm.functionId,
    functionName: norm.functionName,
    eventName: norm.eventName,
    type: jobType,
    title: metadata.title,
    subtitle: metadata.subtitle,
    status: norm.status,
    queuedAt: norm.queuedAt,
    startedAt: norm.startedAt,
    endedAt: norm.endedAt,
    durationMs: computeDurationMs(norm.startedAt, norm.endedAt),
    url: metadata.url,
    errorMessage: extractErrorMessage(norm.status, norm.output),
    entityId: metadata.entityId,
  };
}

/**
 * Fetches Inngest background job runs for a user with automatic offline resilience.
 * Uses the Inngest REST v2 API (`GET /v2/runs`) uniformly across local development and production.
 *
 * @param userId - Authenticated user identifier
 * @param options - Optional status filter and pagination limit
 * @returns Result object containing job items, offline flag, and optional error message
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

    const baseUrl = resolveInngestApiBaseUrl();
    const headers = resolveInngestHeaders();
    const url = buildRunsUrl(baseUrl, userId, options);
    const signal = AbortSignal.timeout(HTTP_TIMEOUT_MS);

    const res = await fetch(url.toString(), {
      headers,
      signal,
    });

    if (!res.ok) {
      return {
        jobs: [],
        offline: true,
        error: `Inngest API request failed with HTTP ${res.status}`,
      };
    }

    const body = await res.json();
    const runs: any[] = Array.isArray(body?.data) ? body.data : [];
    const eventCache = new Map<
      string,
      Promise<{ data?: Record<string, any>; name?: string } | null>
    >();

    const jobResults = await Promise.all(
      runs.map((run) =>
        buildJobItem(run, baseUrl, userId, headers, signal, eventCache),
      ),
    );

    const jobs = jobResults.filter((job): job is JobItem => job !== null);
    return { jobs };
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
 * Verifies that a run belongs to the specified user before allowing mutation.
 *
 * @param baseUrl - Normalized Inngest API base URL
 * @param headers - HTTP headers
 * @param runId - Workflow run identifier
 * @param userId - Target user identifier
 * @param signal - AbortSignal
 * @returns Verification result with optional error message
 * @author Maruf Bepary
 */
async function verifyRunOwnership(
  baseUrl: string,
  headers: Record<string, string>,
  runId: string,
  userId: string,
  signal: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  const runRes = await fetch(`${baseUrl}/v2/runs/${runId}`, {
    headers,
    signal,
  });

  if (!runRes.ok) {
    return {
      ok: false,
      error: `Failed to verify run ownership: HTTP ${runRes.status}`,
    };
  }

  const runBody = await runRes.json();
  const run = runBody?.data ?? runBody;
  const { payloadData } = await resolveRunEventData(
    run,
    baseUrl,
    headers,
    signal,
  );

  if (isMismatchedUser(payloadData, userId)) {
    return {
      ok: false,
      error: "Run does not belong to user or trigger payload is missing",
    };
  }

  return { ok: true };
}

/**
 * Cancels an Inngest background workflow run.
 * When `userId` is provided, verifies ownership by fetching run details before cancelling.
 * Uses the Inngest REST v2 API (`POST /v2/runs/{runId}/cancel`) uniformly across environments.
 *
 * @param runId - Workflow run identifier
 * @param userId - Optional user identifier to verify ownership
 * @returns Success flag and optional error message
 * @author Maruf Bepary
 */
export async function cancelInngestRun(
  runId: string,
  userId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = resolveInngestApiBaseUrl();
    const headers = resolveInngestHeaders();
    const signal = AbortSignal.timeout(HTTP_TIMEOUT_MS);

    if (userId) {
      const ownership = await verifyRunOwnership(
        baseUrl,
        headers,
        runId,
        userId,
        signal,
      );
      if (!ownership.ok) {
        return {
          success: false,
          error: ownership.error,
        };
      }
    }

    const res = await fetch(`${baseUrl}/v2/runs/${runId}/cancel`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      signal,
    });

    if (res.ok || res.status === 409) {
      return { success: true };
    }

    const errText = await res.text();
    if (isAlreadyEndedError(errText)) {
      return { success: true };
    }

    return {
      success: false,
      error: errText || `Failed with status ${res.status}`,
    };
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
