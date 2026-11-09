import { env } from "@/config/env";
import type { JobStatus, JobType } from "@/types/jobs";

/**
 * Timeout in milliseconds for Inngest dev server and cloud API requests.
 */
export const HTTP_TIMEOUT_MS = 3000;

/**
 * Determines whether the service is executing in development mode.
 */
export function isDevMode(): boolean {
  return Boolean(
    env.INNGEST_DEV === "1" ||
      env.INNGEST_DEV === "true" ||
      env.NODE_ENV !== "production" ||
      !env.INNGEST_SIGNING_KEY ||
      env.INNGEST_SIGNING_KEY === "local",
  );
}

/**
 * Resolves Inngest signing key, omitting "local" placeholders.
 *
 * @returns Production signing key or undefined in dev/local mode
 * @author Maruf Bepary
 */
export function resolveInngestSigningKey(): string | undefined {
  if (!env.INNGEST_SIGNING_KEY || env.INNGEST_SIGNING_KEY === "local") {
    return undefined;
  }
  return env.INNGEST_SIGNING_KEY;
}

/**
 * Resolves Inngest event key, omitting "local" placeholders.
 *
 * @returns Production event key or undefined in dev/local mode
 * @author Maruf Bepary
 */
export function resolveInngestEventKey(): string | undefined {
  if (!env.INNGEST_EVENT_KEY || env.INNGEST_EVENT_KEY === "local") {
    return undefined;
  }
  return env.INNGEST_EVENT_KEY;
}

/**
 * Resolves the Inngest API base URL for REST v2 queries.
 * Trims trailing slashes and removes accidental serve endpoint paths (/api/inngest).
 *
 * @returns Base URL without trailing slash or serve endpoint suffix
 * @author Maruf Bepary
 */
export function resolveInngestApiBaseUrl(): string {
  const base =
    env.INNGEST_BASE_URL ||
    (isDevMode() ? "http://127.0.0.1:8288" : "https://api.inngest.com");
  return base
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/inngest$/, "")
    .replace(/\/+$/, "");
}

/**
 * Constructs standard headers for Inngest REST v2 and v1 requests.
 * Includes Bearer Authorization header only when a non-local signing key is configured.
 *
 * @returns Header dictionary
 * @author Maruf Bepary
 */
export function resolveInngestHeaders(): Record<string, string> {
  const signingKey = resolveInngestSigningKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signingKey) {
    headers.Authorization = `Bearer ${signingKey}`;
  }
  return headers;
}

/**
 * Resolves job category type based on triggering event name.
 *
 * @param eventName - Target event name
 * @returns The resolved result
 * @author Maruf Bepary
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
 * Extracts the first truthy value among candidate items.
 *
 * @param candidates - Target candidates
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function firstNonEmpty<T>(
  ...candidates: (T | undefined | null)[]
): T | undefined {
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return undefined;
}

/**
 * Extracts inline payload data from various run properties across Inngest versions.
 *
 * @param run - Raw run record from Inngest
 * @returns The resolved payload data record if present
 * @author Maruf Bepary
 */
export function extractInlinePayloadData(
  run: Record<string, any>,
): Record<string, any> | undefined {
  if (run.trigger?.data && typeof run.trigger.data === "object") {
    return run.trigger.data;
  }
  if (run.event?.data && typeof run.event.data === "object") {
    return run.event.data;
  }
  if (run.data && typeof run.data === "object") {
    return run.data;
  }
  return undefined;
}

/**
 * Extracts triggering event identifier from Inngest v2 or flat run records.
 *
 * @param run - Raw run record from Inngest
 * @returns Event ULID string or undefined
 * @author Maruf Bepary
 */
export function extractTriggerEventId(
  run: Record<string, any>,
): string | undefined {
  if (Array.isArray(run.trigger?.eventIds) && run.trigger.eventIds.length > 0) {
    return run.trigger.eventIds[0];
  }
  return run.event_id ?? run.eventId ?? undefined;
}

/**
 * Normalized run fields across Inngest REST v2, GraphQL, and flat shapes.
 *
 * @author Maruf Bepary
 */
export interface NormalizedRun {
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
 * Normalizes an Inngest run object into standard application fields.
 * Supports canonical v2 structures (`function.id`, `trigger.eventName`) as well as
 * legacy/flat properties (`function_id`, `event_name`).
 *
 * @param run - Raw run record
 * @param fallbackPayloadData - Optional externally resolved payload data (e.g. from /v1/events)
 * @param fallbackEventName - Optional externally resolved event name
 * @returns NormalizedRun
 * @author Maruf Bepary
 */
export function normalizeRunFields(
  run: Record<string, any>,
  fallbackPayloadData?: Record<string, any>,
  fallbackEventName?: string,
): NormalizedRun {
  const functionId =
    firstNonEmpty<string>(
      run.function?.slug,
      run.function?.id,
      run.function_id,
      run.functionId,
    ) ?? "";
  const functionName =
    firstNonEmpty<string>(
      run.function?.name,
      run.function_name,
      run.functionName,
      functionId,
    ) ?? "";
  const eventName =
    firstNonEmpty<string>(
      run.trigger?.eventName,
      run.event_name,
      run.eventName,
      run.trigger?.name,
      fallbackEventName,
    ) ?? "";
  const queuedAt =
    firstNonEmpty<string>(run.queued_at, run.queuedAt) ??
    new Date().toISOString();
  const startedAt =
    firstNonEmpty<string>(run.started_at, run.startedAt) ?? null;
  const endedAt = firstNonEmpty<string>(run.ended_at, run.endedAt) ?? null;

  return {
    payloadData: extractInlinePayloadData(run) ?? fallbackPayloadData,
    eventName,
    functionId,
    functionName,
    status: (run.status as JobStatus) || "QUEUED",
    queuedAt,
    startedAt,
    endedAt,
    output: firstNonEmpty(run.output, run.error),
  };
}

const ENTITY_ID_KEYS = [
  "chatId",
  "runId",
  "translationId",
  "documentId",
  "kbId",
] as const;

/**
 * Extracts payload entity id.
 *
 * @param payloadData - Target payload data
 * @returns The resolved result
 * @author Maruf Bepary
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
 * Resolves transform url.
 *
 * @param payloadData - Target payload data
 * @param entityId - Target entity id
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveTransformUrl(
  payloadData?: Record<string, any>,
  entityId?: string,
): string {
  if (payloadData?.agentId && entityId) {
    return `/transform/${payloadData.agentId}/${entityId}`;
  }
  if (entityId) {
    return `/transform?runId=${entityId}`;
  }
  return "/transform";
}

/**
 * Represents metadata result.
 *
 * @author Maruf Bepary
 */
type MetadataResult = {
  title: string;
  subtitle?: string;
  url?: string;
};

/**
 * Represents metadata builder.
 *
 * @author Maruf Bepary
 */
type MetadataBuilder = (
  payloadData: Record<string, any> | undefined,
  entityId: string | undefined,
  fallbackTitle: string,
) => MetadataResult;

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
    url: "/translation",
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
 * Resolves job metadata.
 *
 * @param jobType - Target job type
 * @param eventName - Target event name
 * @param functionName - Target function name
 * @param payloadData - Target payload data
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function resolveJobMetadata(
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
  const builder = JOB_METADATA_BUILDERS[jobType];
  const built = builder(payloadData, entityId, fallbackTitle);

  return {
    title: built.title,
    subtitle: built.subtitle,
    entityId,
    url: built.url,
  };
}

/**
 * Performs compute duration ms.
 *
 * @param startedAt - Target started at
 * @param endedAt - Target ended at
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function computeDurationMs(
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
 * Parses object error.
 *
 * @param obj - Target obj
 * @returns The resolved result
 * @author Maruf Bepary
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
 * Extracts error message.
 *
 * @param status - Current status value
 * @param output - Target output
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function extractErrorMessage(
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
 * Determines whether the trigger payload belongs to a different user, or lacks user attribution.
 * Fails closed: if userId is specified, any missing payload, missing userId, or mismatched userId
 * is treated as mismatched to prevent cross-tenant leakage.
 *
 * @param payloadData - Target payload data
 * @param userId - Optional user identifier to verify against
 * @returns True if the payload does not belong to the user; false if it matches or if no userId was specified
 * @author Maruf Bepary
 */
export function isMismatchedUser(
  payloadData?: Record<string, any> | null,
  userId?: string,
): boolean {
  if (!userId) return false;
  return !payloadData?.userId || payloadData.userId !== userId;
}

const ALREADY_ENDED_PHRASES = [
  "cannot cancel an ended run",
  "already completed",
  "already ended",
  "already cancelled",
  "not running",
  "not active",
] as const;

/**
 * Determines whether already ended error.
 *
 * @param message - Target message
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function isAlreadyEndedError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return ALREADY_ENDED_PHRASES.some((phrase) => lower.includes(phrase));
}
