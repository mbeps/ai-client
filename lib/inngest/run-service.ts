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
function resolveJobType(eventName?: string | null): JobType {
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
 * Extracts the first truthy value among candidate items.
 *
 * @param candidates Values to evaluate in priority order.
 * @returns The first truthy candidate or undefined.
 */
function firstNonEmpty<T>(
  ...candidates: (T | undefined | null)[]
): T | undefined {
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return undefined;
}

/**
 * Parses a JSON string and extracts its data property if present.
 *
 * @param str JSON string to parse.
 * @returns Extracted payload object or undefined.
 */
function parsePayloadString(str: string): Record<string, any> | undefined {
  try {
    const parsed = JSON.parse(str);
    if (!parsed || typeof parsed !== "object") return undefined;
    return parsed.data ?? parsed;
  } catch {
    return undefined;
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
  const first = payloads?.[0];
  if (typeof first === "string") return parsePayloadString(first);
  if (first && typeof first === "object") {
    const rec = first as Record<string, any>;
    return rec.data ?? rec;
  }
  return undefined;
}

/**
 * Entity ID keys in priority order for metadata extraction.
 */
const ENTITY_ID_KEYS = [
  "chatId",
  "runId",
  "translationId",
  "documentId",
  "kbId",
] as const;

/**
 * Extracts primary entity identifier from parsed event payload data.
 *
 * @param payloadData Parsed event data.
 * @returns Primary entity ID string or undefined.
 */
function extractPayloadEntityId(
  payloadData?: Record<string, any>,
): string | undefined {
  if (!payloadData) return undefined;
  for (const key of ENTITY_ID_KEYS) {
    if (payloadData[key]) {
      return String(payloadData[key]);
    }
  }
  return undefined;
}

/**
 * Resolves the destination URL for transform workflow runs.
 *
 * @param payloadData Parsed event data.
 * @param entityId Extracted entity identifier.
 * @returns Formatted transform route path.
 */
function resolveTransformUrl(
  payloadData?: Record<string, any>,
  entityId?: string,
): string {
  if (payloadData?.agentId && entityId) {
    return `/workflows/transform/${payloadData.agentId}/${entityId}`;
  }
  if (entityId) {
    return `/workflows/transform?runId=${entityId}`;
  }
  return "/workflows/transform";
}

type MetadataResult = {
  title: string;
  subtitle?: string;
  url?: string;
};

type MetadataBuilder = (
  payloadData: Record<string, any> | undefined,
  entityId: string | undefined,
  fallbackTitle: string,
) => MetadataResult;

/**
 * Builders for display title, subtitle, and navigation URL per job type.
 */
const JOB_METADATA_BUILDERS: Record<JobType, MetadataBuilder> = {
  chat: (payloadData, entityId) => ({
    title: "Chat Response",
    subtitle: payloadData?.model ? `Model: ${payloadData.model}` : undefined,
    url: entityId ? `/chats/${entityId}` : undefined,
  }),
  transform: (payloadData, entityId) => ({
    title: "Transform Workflow",
    subtitle: payloadData?.agentName
      ? String(payloadData.agentName)
      : undefined,
    url: resolveTransformUrl(payloadData, entityId),
  }),
  translation: (payloadData) => ({
    title: "Document Translation",
    subtitle:
      payloadData?.sourceLanguage && payloadData?.targetLanguage
        ? `${payloadData.sourceLanguage} → ${payloadData.targetLanguage}`
        : undefined,
    url: "/workflows/translation",
  }),
  "kb-ingest": (payloadData, entityId) => ({
    title: "Document Ingestion",
    subtitle: payloadData?.documentName
      ? String(payloadData.documentName)
      : entityId
        ? `Document ${entityId}`
        : undefined,
    url: "/knowledgebases",
  }),
  "kb-reindex": (payloadData, entityId) => ({
    title: "Knowledge Base Reindex",
    subtitle: payloadData?.kbTitle
      ? String(payloadData.kbTitle)
      : entityId
        ? `KB ${entityId}`
        : undefined,
    url: entityId ? `/knowledgebases/${entityId}` : "/knowledgebases",
  }),
  other: (_payloadData, _entityId, fallbackTitle) => ({
    title: fallbackTitle,
  }),
};

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
  const entityId = extractPayloadEntityId(payloadData);
  const fallbackTitle = functionName || eventName || "Background Job";
  const builder = JOB_METADATA_BUILDERS[jobType] ?? JOB_METADATA_BUILDERS.other;
  const built = builder(payloadData, entityId, fallbackTitle);

  return {
    title: built.title,
    subtitle: built.subtitle,
    entityId,
    url: built.url,
  };
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
 * Extracts error details from an object-shaped run error output.
 *
 * @param obj Error payload object.
 * @returns Formatted error string or undefined.
 */
function parseObjectError(obj: Record<string, any>): string | undefined {
  if (obj.error) {
    if (typeof obj.error === "string") return obj.error;
    return obj.error?.message || JSON.stringify(obj.error);
  }
  if (obj.message) {
    return String(obj.message);
  }
  return undefined;
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
  if (typeof output === "object") {
    const parsed = parseObjectError(output as Record<string, any>);
    if (parsed) return parsed;
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
 * Resolves event name between trigger and node with fallback.
 *
 * @param trigger Dev run trigger details.
 * @param node GraphQL run node.
 * @returns Resolved event name string.
 */
function resolveDevEventName(
  trigger: { eventName?: string } | null,
  node: Record<string, any>,
): string {
  if (trigger?.eventName) return trigger.eventName;
  return node.eventName ?? "";
}

/**
 * Extracts function name and slug from a dev run node.
 *
 * @param node GraphQL run node.
 * @returns Function name and slug identifiers.
 */
function extractDevFunctionInfo(node: Record<string, any>): {
  name: string;
  slug: string;
} {
  const fn = node.function;
  const fallback = node.functionID ?? "";
  return {
    name: fn?.name || fallback,
    slug: fn?.slug || fallback,
  };
}

/**
 * Checks whether the payload user ID mismatches the authenticated user.
 *
 * @param payloadData Parsed event data.
 * @param userId Authenticated user identifier.
 * @returns True if payload belongs to another user.
 */
function isMismatchedUser(
  payloadData: Record<string, any> | undefined,
  userId: string,
): boolean {
  return Boolean(payloadData?.userId && payloadData.userId !== userId);
}

/**
 * Asynchronously constructs a JobItem from an Inngest dev-mode GraphQL node.
 *
 * @param node GraphQL node representing a run.
 * @param gqlEndpoint Dev GraphQL endpoint URL.
 * @param userId Authenticated user identifier.
 * @param signal AbortSignal for network timeouts.
 * @returns Built JobItem or null if unauthorized.
 */
async function buildDevJobItem(
  node: Record<string, any>,
  gqlEndpoint: string,
  userId: string,
  signal: AbortSignal,
): Promise<JobItem | null> {
  const trigger = await fetchDevRunTrigger(gqlEndpoint, node.id, signal);
  const payloadData = parseTriggerPayloadData(trigger?.payloads);

  if (isMismatchedUser(payloadData, userId)) {
    return null;
  }

  const eventName = resolveDevEventName(trigger, node);
  const jobType = resolveJobType(eventName);
  const fnInfo = extractDevFunctionInfo(node);
  const metadata = resolveJobMetadata(
    jobType,
    eventName,
    fnInfo.name,
    payloadData,
  );
  const status = node.status as JobStatus;

  return {
    id: node.id,
    functionId: fnInfo.slug,
    functionName: fnInfo.name,
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
}

/**
 * Builds GraphQL query variables for filtering runs in dev mode.
 *
 * @param userId Authenticated user ID.
 * @param options Status and limit options.
 * @returns GraphQL variables object.
 */
function buildDevRunsQueryVariables(
  userId: string,
  options?: { status?: JobStatus[]; limit?: number },
): { filter: Record<string, unknown>; orderBy: unknown[]; first: number } {
  const filter: Record<string, unknown> = {
    from: DEFAULT_FILTER_FROM,
    query: `event.data.userId == "${userId}"`,
  };

  if (options?.status && options.status.length > 0) {
    filter.status = options.status;
  }

  return {
    filter,
    orderBy: [{ field: "QUEUED_AT", direction: "DESC" }],
    first: options?.limit ?? 20,
  };
}

/**
 * Safely extracts edges array from Inngest GraphQL response body.
 *
 * @param body Response body from GraphQL dev server.
 * @returns Array of run edges.
 */
function extractRunEdges(body: any): any[] {
  const runs = body?.data?.runs;
  return Array.isArray(runs?.edges) ? runs.edges : [];
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
  const variables = buildDevRunsQueryVariables(userId, options);
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
  const edges = extractRunEdges(body);

  // Fetch trigger payloads for each run in parallel to extract entity IDs & verify user scoping
  const jobsWithTriggers = await Promise.all(
    edges.map((edge: { node: any }) =>
      buildDevJobItem(edge.node, gqlEndpoint, userId, signal),
    ),
  );

  const jobs = jobsWithTriggers.filter((job): job is JobItem => job !== null);
  return { jobs };
}

/**
 * Extracts payload data from a production run with field fallbacks.
 *
 * @param run Production run record.
 * @returns Payload data object or undefined.
 */
function extractProdPayloadData(
  run: Record<string, any>,
): Record<string, any> | undefined {
  if (run.trigger?.data) return run.trigger.data;
  if (run.event?.data) return run.event.data;
  return run.data;
}

/**
 * Extracts event name from a production run with fallback priority.
 *
 * @param run Production run record.
 * @returns Event name string.
 */
function extractProdEventName(run: Record<string, any>): string {
  if (run.event_name) return run.event_name;
  if (run.eventName) return run.eventName;
  if (run.trigger?.name) return run.trigger.name;
  return "";
}

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
 * Normalizes snake_case / camelCase fallback fields from a production Inngest run.
 *
 * @param run Raw run object from Inngest REST API.
 * @returns Clean normalized run fields.
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
 * Constructs a JobItem from a production Inngest run object.
 *
 * @param run Raw run record from Inngest REST API.
 * @param userId Authenticated user identifier.
 * @returns Normalized JobItem or null if ownership check fails.
 */
function buildProdJobItem(
  run: Record<string, any>,
  userId: string,
): JobItem | null {
  const norm = normalizeProdRunFields(run);

  // Defense-in-depth: enforce application-level user scoping
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
 * Constructs URL and query parameters for production Inngest runs API request.
 *
 * @param userId Authenticated user identifier.
 * @param options Status and limit filter options.
 * @returns Configured URL instance.
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
 * Error phrases indicating an Inngest run has already terminated.
 */
const ALREADY_ENDED_PHRASES = [
  "cannot cancel an ended run",
  "already completed",
  "already ended",
  "already cancelled",
  "not running",
  "not active",
] as const;

/**
 * Checks whether an error message indicates the run has already ended.
 *
 * @param message Error message text.
 * @returns True if error indicates completion/cancellation.
 */
function isAlreadyEndedError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return ALREADY_ENDED_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * Executes a run cancellation against the Inngest GraphQL dev server.
 *
 * @param runId Inngest run identifier.
 * @param signal AbortSignal for network timeout.
 * @returns Success flag and optional error message.
 */
async function cancelDevRun(
  runId: string,
  signal: AbortSignal,
): Promise<{ success: boolean; error?: string }> {
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

/**
 * Executes a run cancellation against the Inngest production REST API.
 *
 * @param runId Inngest run identifier.
 * @param signal AbortSignal for network timeout.
 * @returns Success flag and optional error message.
 */
async function cancelProdRun(
  runId: string,
  signal: AbortSignal,
): Promise<{ success: boolean; error?: string }> {
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
