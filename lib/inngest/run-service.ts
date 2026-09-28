import { env } from "@/config/env";
import { inngest } from "@/lib/inngest/client";
import { getLogger, logger } from "@/lib/logger";
import type { JobItem, JobStatus, JobType, ListJobsResult } from "@/types/jobs";

const log = getLogger(["inngest", "run-service"]);

/**
 * Timeout in milliseconds for Inngest dev server and cloud API requests.
 */
const HTTP_TIMEOUT_MS = 3000;

/**
 * Fallback ISO date string required by Inngest GraphQL schema for RunsFilterV2.
 */
const DEFAULT_FILTER_FROM = "2020-01-01T00:00:00Z";

/**
 * Determines whether the service is executing in development mode.
 * Falls back to dev mode if explicitly configured, running outside production,
 * or when no cloud signing key is provided.
 *
 * @returns True if development mode should be used.
 */
function isDevMode(): boolean {
  return Boolean(
    env.INNGEST_DEV === "1" ||
      env.INNGEST_DEV === "true" ||
      env.NODE_ENV !== "production" ||
      !env.INNGEST_SIGNING_KEY ||
      env.INNGEST_SIGNING_KEY === "local",
  );
}

/**
 * Resolves job category type based on triggering event name.
 *
 * @param eventName Name of triggering Inngest event.
 * @returns Categorised JobType identifier.
 */
export function resolveJobType(eventName?: string | null): JobType {
  switch (eventName) {
    case "chat/response.generate":
      return "chat";
    case "workflows/transform.execute":
      return "transform";
    case "workflows/translate.execute":
      return "translation";
    case "knowledgebase/document.ingest":
      return "kb-ingest";
    case "knowledgebase/reindex":
      return "kb-reindex";
    default:
      return "other";
  }
}

/**
 * Extracts payload data and entity identifiers from trigger event payloads.
 *
 * @param payloads Serialized JSON strings or payload objects from runTrigger.
 * @returns Extracted payload data object or undefined.
 */
function parseTriggerPayloadData(
  payloads?: unknown[],
): Record<string, any> | undefined {
  if (!payloads || payloads.length === 0) return undefined;
  const first = payloads[0];

  if (typeof first === "string") {
    try {
      const parsed = JSON.parse(first);
      return parsed?.data ?? parsed;
    } catch {
      return undefined;
    }
  }

  if (typeof first === "object" && first !== null) {
    return (
      (first as Record<string, any>).data ?? (first as Record<string, any>)
    );
  }

  return undefined;
}

/**
 * Computes display title, subtitle, entityId, and navigation URL for a run.
 *
 * @param jobType Categorised job type.
 * @param eventName Triggering event name.
 * @param functionName Human readable function name.
 * @param payloadData Parsed event data.
 * @returns Enriched metadata for the job item.
 */
function resolveJobMetadata(
  jobType: JobType,
  eventName: string,
  functionName: string,
  payloadData?: Record<string, any>,
): {
  title: string;
  subtitle?: string;
  entityId?: string;
  url?: string;
} {
  let entityId: string | undefined;
  let title = functionName || eventName || "Background Job";
  let subtitle: string | undefined;
  let url: string | undefined;

  if (payloadData) {
    if (payloadData.chatId) entityId = String(payloadData.chatId);
    else if (payloadData.runId) entityId = String(payloadData.runId);
    else if (payloadData.translationId)
      entityId = String(payloadData.translationId);
    else if (payloadData.documentId) entityId = String(payloadData.documentId);
    else if (payloadData.kbId) entityId = String(payloadData.kbId);
  }

  switch (jobType) {
    case "chat":
      title = "Chat Response";
      if (payloadData?.model) subtitle = `Model: ${payloadData.model}`;
      if (entityId) url = `/chats/${entityId}`;
      break;

    case "transform":
      title = "Transform Workflow";
      if (payloadData?.agentName) subtitle = String(payloadData.agentName);
      if (payloadData?.agentId && entityId) {
        url = `/workflows/transform/${payloadData.agentId}/${entityId}`;
      } else if (entityId) {
        url = `/workflows/transform?runId=${entityId}`;
      } else {
        url = `/workflows/transform`;
      }
      break;

    case "translation":
      title = "Document Translation";
      if (payloadData?.sourceLanguage && payloadData?.targetLanguage) {
        subtitle = `${payloadData.sourceLanguage} → ${payloadData.targetLanguage}`;
      }
      url = "/workflows/translation";
      break;

    case "kb-ingest":
      title = "Document Ingestion";
      if (payloadData?.documentName) {
        subtitle = String(payloadData.documentName);
      } else if (entityId) {
        subtitle = `Document ${entityId}`;
      }
      url = "/knowledgebases";
      break;

    case "kb-reindex":
      title = "Knowledge Base Reindex";
      if (payloadData?.kbTitle) {
        subtitle = String(payloadData.kbTitle);
      } else if (entityId) {
        subtitle = `KB ${entityId}`;
      }
      url = entityId ? `/knowledgebases/${entityId}` : "/knowledgebases";
      break;

    default:
      title = functionName || eventName || "Background Job";
      break;
  }

  return { title, subtitle, entityId, url };
}

/**
 * Calculates execution duration in milliseconds from run timestamps.
 *
 * @param startedAt ISO timestamp when job execution started.
 * @param endedAt ISO timestamp when job execution ended.
 * @returns Duration in milliseconds, or undefined if job has not started.
 */
function computeDurationMs(
  startedAt?: string | null,
  endedAt?: string | null,
): number | undefined {
  if (!startedAt) return undefined;
  const start = new Date(startedAt).getTime();
  if (endedAt) {
    const end = new Date(endedAt).getTime();
    return Math.max(0, end - start);
  }
  return Math.max(0, Date.now() - start);
}

/**
 * Parses error messages from run output if available.
 *
 * @param status Job status.
 * @param output Output field from Inngest run.
 * @returns Extracted error message or undefined.
 */
function extractErrorMessage(
  status: JobStatus,
  output: unknown,
): string | undefined {
  if (status !== "FAILED") return undefined;
  if (!output) return "Job execution failed";

  if (typeof output === "string") return output;
  if (typeof output === "object" && output !== null) {
    const obj = output as Record<string, any>;
    if (obj.error) {
      return typeof obj.error === "string"
        ? obj.error
        : obj.error?.message || JSON.stringify(obj.error);
    }
    if (obj.message) return String(obj.message);
  }
  return "Job execution failed";
}

/**
 * GraphQL document querying runs with filter, order, and pagination arguments.
 */
const RUNS_QUERY = `
  query FetchUserRuns($filter: RunsFilterV2!, $orderBy: [RunsV2OrderBy!]!, $first: Int!) {
    runs(filter: $filter, orderBy: $orderBy, first: $first) {
      edges {
        node {
          id
          functionID
          function {
            name
            slug
          }
          eventName
          queuedAt
          startedAt
          endedAt
          status
          output
        }
      }
    }
  }
`;

/**
 * GraphQL document querying trigger event name and payloads for a specific run.
 */
const TRIGGER_QUERY = `
  query FetchRunTrigger($runID: String!) {
    runTrigger(runID: $runID) {
      eventName
      payloads
    }
  }
`;

/**
 * GraphQL document cancelling a function run.
 */
const CANCEL_RUN_MUTATION = `
  mutation CancelRun($runID: ULID!) {
    cancelRun(runID: $runID) {
      id
      status
    }
  }
`;

/**
 * Fetches trigger details for a specific run from the Inngest GraphQL dev server.
 *
 * @param gqlEndpoint GraphQL endpoint URL.
 * @param runId Inngest run identifier.
 * @param signal AbortSignal for HTTP timeout cancellation.
 * @returns Trigger event name and payloads, or null on error.
 */
async function fetchDevRunTrigger(
  gqlEndpoint: string,
  runId: string,
  signal: AbortSignal,
): Promise<{ eventName?: string; payloads?: unknown[] } | null> {
  try {
    const res = await fetch(gqlEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: TRIGGER_QUERY,
        variables: { runID: runId },
      }),
      signal,
    });

    if (!res.ok) return null;
    const body = await res.json();
    return body?.data?.runTrigger ?? null;
  } catch (err) {
    log.debug("Failed to fetch run trigger for run {runId}: {error}", {
      runId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Retrieves Inngest background job runs for a specific user in dev mode via GraphQL.
 *
 * @param userId Authenticated user identifier.
 * @param options Filtering options including status and result limit.
 * @returns ListJobsResult with normalized job items.
 */
async function fetchDevUserRuns(
  userId: string,
  options?: { status?: JobStatus[]; limit?: number },
): Promise<ListJobsResult> {
  const baseUrl = env.INNGEST_BASE_URL || "http://127.0.0.1:8288";
  const gqlEndpoint = `${baseUrl}/v0/gql`;

  const filter: Record<string, unknown> = {
    from: DEFAULT_FILTER_FROM,
    query: `event.data.userId == "${userId}"`,
  };

  if (options?.status && options.status.length > 0) {
    filter.status = options.status;
  }

  const variables = {
    filter,
    orderBy: [{ field: "QUEUED_AT", direction: "DESC" }],
    first: options?.limit ?? 20,
  };

  const signal = AbortSignal.timeout(HTTP_TIMEOUT_MS);

  const res = await fetch(gqlEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: RUNS_QUERY, variables }),
    signal,
  });

  if (!res.ok) {
    return {
      jobs: [],
      error: `GraphQL request failed with HTTP ${res.status}`,
    };
  }

  const body = await res.json();
  const edges = body?.data?.runs?.edges ?? [];

  // Fetch trigger payloads for each run in parallel to extract entity IDs & verify user scoping
  const jobsWithTriggers = await Promise.all(
    edges.map(async (edge: { node: any }) => {
      const node = edge.node;
      const trigger = await fetchDevRunTrigger(gqlEndpoint, node.id, signal);
      const payloadData = parseTriggerPayloadData(trigger?.payloads);

      // Defense-in-depth: enforce application-level user ownership check
      if (payloadData?.userId && payloadData.userId !== userId) {
        return null;
      }

      const eventName = trigger?.eventName || node.eventName || "";
      const jobType = resolveJobType(eventName);
      const functionName = node.function?.name || node.functionID || "";
      const metadata = resolveJobMetadata(
        jobType,
        eventName,
        functionName,
        payloadData,
      );
      const status = node.status as JobStatus;

      const item: JobItem = {
        id: node.id,
        functionId: node.function?.slug || node.functionID || "",
        functionName,
        eventName,
        type: jobType,
        title: metadata.title,
        subtitle: metadata.subtitle,
        status,
        queuedAt: node.queuedAt,
        startedAt: node.startedAt ?? null,
        endedAt: node.endedAt ?? null,
        durationMs: computeDurationMs(node.startedAt, node.endedAt),
        url: metadata.url,
        errorMessage: extractErrorMessage(status, node.output),
        entityId: metadata.entityId,
      };

      return item;
    }),
  );

  const jobs = jobsWithTriggers.filter((job): job is JobItem => job !== null);
  return { jobs };
}

/**
 * Retrieves Inngest background job runs for a user in production mode via Inngest REST API v1.
 *
 * @param userId Authenticated user identifier.
 * @param options Filtering options including status and result limit.
 * @returns ListJobsResult with normalized job items.
 */
async function fetchProdUserRuns(
  userId: string,
  options?: { status?: JobStatus[]; limit?: number },
): Promise<ListJobsResult> {
  const url = new URL("https://api.inngest.com/v1/runs");
  url.searchParams.set("query", `event.data.userId == "${userId}"`);
  url.searchParams.set("limit", String(options?.limit ?? 20));

  if (options?.status && options.status.length > 0) {
    for (const s of options.status) {
      url.searchParams.append("status", s);
    }
  }

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
    .map((run) => {
      const payloadData =
        run.trigger?.data || run.event?.data || run.data || undefined;

      // Defense-in-depth: enforce application-level user scoping
      if (payloadData?.userId && payloadData.userId !== userId) {
        return null;
      }

      const eventName =
        run.event_name || run.eventName || run.trigger?.name || "";
      const jobType = resolveJobType(eventName);
      const functionName =
        run.function_name || run.functionName || run.function_id || "";
      const metadata = resolveJobMetadata(
        jobType,
        eventName,
        functionName,
        payloadData,
      );
      const status = (run.status as JobStatus) || "QUEUED";

      const item: JobItem = {
        id: run.id,
        functionId: run.function_id || run.functionId || "",
        functionName,
        eventName,
        type: jobType,
        title: metadata.title,
        subtitle: metadata.subtitle,
        status,
        queuedAt: run.queued_at || run.queuedAt || new Date().toISOString(),
        startedAt: run.started_at || run.startedAt || null,
        endedAt: run.ended_at || run.endedAt || null,
        durationMs: computeDurationMs(
          run.started_at || run.startedAt,
          run.ended_at || run.endedAt,
        ),
        url: metadata.url,
        errorMessage: extractErrorMessage(status, run.output || run.error),
        entityId: metadata.entityId,
      };

      return item;
    })
    .filter((job): job is JobItem => job !== null);

  return { jobs };
}

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
 * Checks whether an error message indicates the run has already ended.
 *
 * @param message Error message text.
 * @returns True if error indicates completion/cancellation.
 */
function isAlreadyEndedError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("cannot cancel an ended run") ||
    lower.includes("already completed") ||
    lower.includes("already ended") ||
    lower.includes("already cancelled") ||
    lower.includes("not running") ||
    lower.includes("not active")
  );
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
 */
export async function cancelInngestRun(
  runId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const signal = AbortSignal.timeout(HTTP_TIMEOUT_MS);

    if (isDevMode()) {
      const baseUrl = env.INNGEST_BASE_URL || "http://127.0.0.1:8288";
      const gqlEndpoint = `${baseUrl}/v0/gql`;

      const res = await fetch(gqlEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: CANCEL_RUN_MUTATION,
          variables: { runID: runId },
        }),
        signal,
      });

      if (!res.ok) {
        return {
          success: false,
          error: `Cancel request failed with HTTP ${res.status}`,
        };
      }

      const body = await res.json();
      if (body.errors && body.errors.length > 0) {
        const errorMsg = body.errors[0]?.message || "";
        if (isAlreadyEndedError(errorMsg)) {
          return { success: true };
        }
        return { success: false, error: errorMsg };
      }

      return { success: true };
    }

    // Production mode
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
