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
 * Resolves job category type based on triggering event name.
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
 * Parses a JSON string and extracts its data property if present.
 */
export function parsePayloadString(
  str: string,
): Record<string, any> | undefined {
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
 */
export function parseTriggerPayloadData(
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

const ENTITY_ID_KEYS = [
  "chatId",
  "runId",
  "translationId",
  "documentId",
  "kbId",
] as const;

export function extractPayloadEntityId(
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

export function resolveTransformUrl(
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

export function isMismatchedUser(
  payloadData: Record<string, any> | undefined,
  userId: string,
): boolean {
  return Boolean(payloadData?.userId && payloadData.userId !== userId);
}

const ALREADY_ENDED_PHRASES = [
  "cannot cancel an ended run",
  "already completed",
  "already ended",
  "already cancelled",
  "not running",
  "not active",
] as const;

export function isAlreadyEndedError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return ALREADY_ENDED_PHRASES.some((phrase) => lower.includes(phrase));
}
