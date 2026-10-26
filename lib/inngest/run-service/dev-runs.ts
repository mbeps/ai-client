import { env } from "@/config/env";
import {
  computeDurationMs,
  extractErrorMessage,
  HTTP_TIMEOUT_MS,
  isAlreadyEndedError,
  isMismatchedUser,
  parseTriggerPayloadData,
  resolveJobMetadata,
  resolveJobType,
} from "@/lib/inngest/run-service/run-metadata";
import { getLogger } from "@/lib/logger";
import type { JobItem, JobStatus, ListJobsResult } from "@/types/jobs";

const log = getLogger(["inngest", "run-service", "dev"]);

const DEFAULT_FILTER_FROM = "2020-01-01T00:00:00Z";

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

const TRIGGER_QUERY = `
  query FetchRunTrigger($runID: String!) {
    runTrigger(runID: $runID) {
      eventName
      payloads
    }
  }
`;

const CANCEL_RUN_MUTATION = `
  mutation CancelRun($runID: ULID!) {
    cancelRun(runID: $runID) {
      id
      status
    }
  }
`;

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

function resolveDevEventName(
  trigger: { eventName?: string } | null,
  node: Record<string, any>,
): string {
  if (trigger?.eventName) return trigger.eventName;
  return node.eventName ?? "";
}

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

function extractRunEdges(body: any): any[] {
  const runs = body?.data?.runs;
  return Array.isArray(runs?.edges) ? runs.edges : [];
}

export async function fetchDevUserRuns(
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

  const jobsWithTriggers = await Promise.all(
    edges.map((edge: { node: any }) =>
      buildDevJobItem(edge.node, gqlEndpoint, userId, signal),
    ),
  );

  const jobs = jobsWithTriggers.filter((job): job is JobItem => job !== null);
  return { jobs };
}

export async function cancelDevRun(
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
