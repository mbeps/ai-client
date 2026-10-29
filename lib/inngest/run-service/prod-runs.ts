import { env } from "@/config/env";
import {
  computeDurationMs,
  extractErrorMessage,
  firstNonEmpty,
  HTTP_TIMEOUT_MS,
  isAlreadyEndedError,
  isMismatchedUser,
  resolveJobMetadata,
  resolveJobType,
} from "@/lib/inngest/run-service/run-metadata";
import type { JobItem, JobStatus, ListJobsResult } from "@/types/jobs";

/**
 * Extracts prod payload data.
 *
 * @param run - Target run
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractProdPayloadData(
  run: Record<string, any>,
): Record<string, any> | undefined {
  if (run.trigger?.data) return run.trigger.data;
  if (run.event?.data) return run.event.data;
  return run.data;
}

/**
 * Extracts prod event name.
 *
 * @param run - Target run
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractProdEventName(run: Record<string, any>): string {
  if (run.event_name) return run.event_name;
  if (run.eventName) return run.eventName;
  if (run.trigger?.name) return run.trigger.name;
  return "";
}

/**
 * Represents normalized prod run.
 *
 * @author Maruf Bepary
 */
interface NormalizedProdRun {
  payloadData?: Record<string, any>;
  eventName: string;
  functionName: string;
  functionId: string;
  status: JobStatus;
  queuedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  output: unknown;
}

/**
 * Performs normalize prod run fields.
 *
 * @param run - Target run
 * @returns The resolved result
 * @author Maruf Bepary
 */
function normalizeProdRunFields(run: Record<string, any>): NormalizedProdRun {
  const functionId =
    firstNonEmpty<string>(run.function_id, run.functionId) ?? "";
  const functionName =
    firstNonEmpty<string>(run.function_name, run.functionName, functionId) ??
    "";
  const queuedAt =
    firstNonEmpty<string>(run.queued_at, run.queuedAt) ??
    new Date().toISOString();
  const startedAt =
    firstNonEmpty<string>(run.started_at, run.startedAt) ?? null;
  const endedAt = firstNonEmpty<string>(run.ended_at, run.endedAt) ?? null;

  return {
    payloadData: extractProdPayloadData(run),
    eventName: extractProdEventName(run),
    functionId,
    functionName,
    status: (run.status as JobStatus) || "QUEUED",
    queuedAt,
    startedAt,
    endedAt,
    output: firstNonEmpty(run.output, run.error),
  };
}

/**
 * Constructs prod job item.
 *
 * @param run - Target run
 * @param userId - User identifier
 * @returns The resolved result
 * @author Maruf Bepary
 */
function buildProdJobItem(
  run: Record<string, any>,
  userId: string,
): JobItem | null {
  const norm = normalizeProdRunFields(run);

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
 * Constructs prod runs url.
 *
 * @param userId - User identifier
 * @param options - Target options
 * @returns The resolved result
 * @author Maruf Bepary
 */
function buildProdRunsUrl(
  userId: string,
  options?: { status?: JobStatus[]; limit?: number },
): URL {
  const url = new URL("https://api.inngest.com/v1/runs");
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
 * Performs fetch prod user runs.
 *
 * @param userId - User identifier
 * @param options - Target options
 * @returns The resolved result
 * @author Maruf Bepary
 */
export async function fetchProdUserRuns(
  userId: string,
  options?: { status?: JobStatus[]; limit?: number },
): Promise<ListJobsResult> {
  const url = buildProdRunsUrl(userId, options);
  const signal = AbortSignal.timeout(HTTP_TIMEOUT_MS);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${env.INNGEST_SIGNING_KEY}`,
      "Content-Type": "application/json",
    },
    signal,
  });

  if (!res.ok) {
    return {
      jobs: [],
      error: `Inngest API request failed with HTTP ${res.status}`,
    };
  }

  const body = await res.json();
  const runs: any[] = Array.isArray(body?.data) ? body.data : [];

  const jobs: JobItem[] = runs
    .map((run) => buildProdJobItem(run, userId))
    .filter((job): job is JobItem => job !== null);

  return { jobs };
}

/**
 * Cancels a workflow run in the Inngest production cloud API.
 * When `userId` is provided, verifies that the run belongs to the user before cancelling.
 *
 * @param runId - Workflow run identifier
 * @param signal - Target signal
 * @param userId - Optional user identifier to verify ownership
 * @returns The resolved result
 * @author Maruf Bepary
 */
export async function cancelProdRun(
  runId: string,
  signal: AbortSignal,
  userId?: string,
): Promise<{ success: boolean; error?: string }> {
  if (userId) {
    const runRes = await fetch(`https://api.inngest.com/v1/runs/${runId}`, {
      headers: {
        Authorization: `Bearer ${env.INNGEST_SIGNING_KEY}`,
        "Content-Type": "application/json",
      },
      signal,
    });

    if (!runRes.ok) {
      return {
        success: false,
        error: `Failed to verify run ownership: HTTP ${runRes.status}`,
      };
    }

    const runBody = await runRes.json();
    const run = runBody?.data ?? runBody;
    const payloadData = extractProdPayloadData(run);

    if (isMismatchedUser(payloadData, userId)) {
      return {
        success: false,
        error: "Run does not belong to user or trigger payload is missing",
      };
    }
  }

  const res = await fetch(`https://api.inngest.com/v1/runs/${runId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.INNGEST_SIGNING_KEY}`,
      "Content-Type": "application/json",
    },
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
}
