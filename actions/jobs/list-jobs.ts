"use server";

import { and, eq, inArray } from "drizzle-orm";
import { ROUTES } from "@/config/routes";
import { db } from "@/drizzle/db";
import {
  chat,
  kbDocument,
  knowledgebase,
  transformAgent,
  transformRun,
  workflowTranslation,
} from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { fetchUserInngestRuns } from "@/lib/inngest/run-service";
import type { JobItem, JobStatus, ListJobsResult } from "@/types/jobs";

/**
 * Filter and pagination options for querying running Inngest jobs.
 */
export interface ListJobsOptions {
  /** Optional status filters to restrict retrieved runs. */
  status?: JobStatus[];
  /** Maximum number of job runs to return. */
  limit?: number;
}

interface EntityIdBuckets {
  chatIds: Set<string>;
  transformRunIds: Set<string>;
  translationIds: Set<string>;
  kbDocIds: Set<string>;
  kbIds: Set<string>;
}

interface ChatEntity {
  id: string;
  title: string;
  projectId: string | null;
}

interface TransformEntity {
  id: string;
  agentId: string;
  agentName: string | null;
}

interface TranslationEntity {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface KbDocEntity {
  id: string;
  name: string;
  kbId: string;
}

interface KbEntity {
  id: string;
  name: string;
}

interface EntityMaps {
  chatMap: Map<string, ChatEntity>;
  transformMap: Map<string, TransformEntity>;
  translationMap: Map<string, TranslationEntity>;
  kbDocMap: Map<string, KbDocEntity>;
  kbMap: Map<string, KbEntity>;
}

/**
 * Collects unique entity IDs per job type for batched database queries.
 */
function collectEntityIds(jobs: readonly JobItem[]): EntityIdBuckets {
  const buckets: EntityIdBuckets = {
    chatIds: new Set<string>(),
    transformRunIds: new Set<string>(),
    translationIds: new Set<string>(),
    kbDocIds: new Set<string>(),
    kbIds: new Set<string>(),
  };

  for (const job of jobs) {
    if (!job.entityId) continue;
    switch (job.type) {
      case "chat":
        buckets.chatIds.add(job.entityId);
        break;
      case "transform":
        buckets.transformRunIds.add(job.entityId);
        break;
      case "translation":
        buckets.translationIds.add(job.entityId);
        break;
      case "kb-ingest":
        buckets.kbDocIds.add(job.entityId);
        break;
      case "kb-reindex":
        buckets.kbIds.add(job.entityId);
        break;
      default:
        break;
    }
  }

  return buckets;
}

/**
 * Batches parallel database queries for associated entities.
 */
async function fetchEntityMaps(
  userId: string,
  buckets: EntityIdBuckets,
): Promise<EntityMaps> {
  const [chatRows, transformRows, translationRows, kbDocRows, kbRows] =
    await Promise.all([
      buckets.chatIds.size > 0
        ? db
            .select({
              id: chat.id,
              title: chat.title,
              projectId: chat.projectId,
            })
            .from(chat)
            .where(
              and(
                inArray(chat.id, [...buckets.chatIds]),
                eq(chat.userId, userId),
              ),
            )
        : Promise.resolve([]),

      buckets.transformRunIds.size > 0
        ? db
            .select({
              id: transformRun.id,
              agentId: transformRun.agentId,
              agentName: transformAgent.name,
            })
            .from(transformRun)
            .leftJoin(
              transformAgent,
              eq(transformRun.agentId, transformAgent.id),
            )
            .where(
              and(
                inArray(transformRun.id, [...buckets.transformRunIds]),
                eq(transformRun.userId, userId),
              ),
            )
        : Promise.resolve([]),

      buckets.translationIds.size > 0
        ? db
            .select({
              id: workflowTranslation.id,
              sourceLanguage: workflowTranslation.sourceLanguage,
              targetLanguage: workflowTranslation.targetLanguage,
            })
            .from(workflowTranslation)
            .where(
              and(
                inArray(workflowTranslation.id, [...buckets.translationIds]),
                eq(workflowTranslation.userId, userId),
              ),
            )
        : Promise.resolve([]),

      buckets.kbDocIds.size > 0
        ? db
            .select({
              id: kbDocument.id,
              name: kbDocument.name,
              kbId: kbDocument.kbId,
            })
            .from(kbDocument)
            .where(
              and(
                inArray(kbDocument.id, [...buckets.kbDocIds]),
                eq(kbDocument.userId, userId),
              ),
            )
        : Promise.resolve([]),

      buckets.kbIds.size > 0
        ? db
            .select({
              id: knowledgebase.id,
              name: knowledgebase.name,
            })
            .from(knowledgebase)
            .where(
              and(
                inArray(knowledgebase.id, [...buckets.kbIds]),
                eq(knowledgebase.userId, userId),
              ),
            )
        : Promise.resolve([]),
    ]);

  return {
    chatMap: new Map(chatRows.map((row) => [row.id, row])),
    transformMap: new Map(transformRows.map((row) => [row.id, row])),
    translationMap: new Map(translationRows.map((row) => [row.id, row])),
    kbDocMap: new Map(kbDocRows.map((row) => [row.id, row])),
    kbMap: new Map(kbRows.map((row) => [row.id, row])),
  };
}

function enrichChatJob(job: JobItem, entity?: ChatEntity): JobItem {
  if (!entity) {
    return {
      ...job,
      entityDeleted: true,
      title: "Chat (Deleted or Unavailable)",
      url: undefined,
    };
  }
  return {
    ...job,
    entityDeleted: false,
    title: entity.title || job.title,
    url: entity.projectId
      ? ROUTES.PROJECTS.chat(entity.projectId, entity.id)
      : ROUTES.CHATS.detail(entity.id),
  };
}

function enrichTransformJob(job: JobItem, entity?: TransformEntity): JobItem {
  if (!entity) {
    return {
      ...job,
      entityDeleted: true,
      title: "Transform (Deleted or Unavailable)",
      url: undefined,
    };
  }
  return {
    ...job,
    entityDeleted: false,
    title: entity.agentName || job.title,
    url: ROUTES.WORKFLOWS.TRANSFORM.runs(entity.agentId, entity.id),
  };
}

function enrichTranslationJob(
  job: JobItem,
  entity?: TranslationEntity,
): JobItem {
  if (!entity) {
    return {
      ...job,
      entityDeleted: true,
      title: "Translation (Deleted or Unavailable)",
      url: undefined,
    };
  }
  return {
    ...job,
    entityDeleted: false,
    subtitle: `${entity.sourceLanguage} → ${entity.targetLanguage}`,
    url: ROUTES.WORKFLOWS.TRANSLATION.path,
  };
}

function enrichKbIngestJob(job: JobItem, entity?: KbDocEntity): JobItem {
  if (!entity) {
    return {
      ...job,
      entityDeleted: true,
      title: "Document (Deleted or Unavailable)",
      url: undefined,
    };
  }
  return {
    ...job,
    entityDeleted: false,
    title: entity.name,
    url: ROUTES.KNOWLEDGEBASES.detail(entity.kbId),
  };
}

function enrichKbReindexJob(job: JobItem, entity?: KbEntity): JobItem {
  if (!entity) {
    return {
      ...job,
      entityDeleted: true,
      title: "Knowledge Base (Deleted or Unavailable)",
      url: undefined,
    };
  }
  return {
    ...job,
    entityDeleted: false,
    title: entity.name,
    url: ROUTES.KNOWLEDGEBASES.detail(entity.id),
  };
}

function enrichJobItem(job: JobItem, maps: EntityMaps): JobItem {
  if (!job.entityId) {
    return { ...job };
  }

  switch (job.type) {
    case "chat":
      return enrichChatJob(job, maps.chatMap.get(job.entityId));
    case "transform":
      return enrichTransformJob(job, maps.transformMap.get(job.entityId));
    case "translation":
      return enrichTranslationJob(job, maps.translationMap.get(job.entityId));
    case "kb-ingest":
      return enrichKbIngestJob(job, maps.kbDocMap.get(job.entityId));
    case "kb-reindex":
      return enrichKbReindexJob(job, maps.kbMap.get(job.entityId));
    default:
      return { ...job };
  }
}

/**
 * Server Action that retrieves and enriches Inngest background job runs for the authenticated user.
 *
 * First queries the Inngest GraphQL/REST run service for the user's active and recent runs.
 * If Inngest is offline or unreachable, gracefully returns an empty job list with `offline: true`.
 *
 * When runs are present, performs batch database queries across associated entities
 * (chats, transform runs/agents, workflow translations, KB documents, and knowledge bases)
 * to enrich jobs with human-readable titles and navigation URLs.
 * If an entity has been deleted from PostgreSQL, marks `entityDeleted: true`, assigns a descriptive
 * fallback title, and clears the navigation URL.
 *
 * @param options Optional status filter and pagination limit.
 * @returns Result object containing enriched jobs, offline flag, and optional error message.
 * @throws {Error} "Unauthorized" if no valid user session is found.
 * @author Maruf Bepary
 */
export async function listJobs(
  options?: ListJobsOptions,
): Promise<ListJobsResult> {
  const session = await requireSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const result = await fetchUserInngestRuns(userId, options);

  if (result.offline || !result.jobs || result.jobs.length === 0) {
    return {
      jobs: [],
      offline: result.offline,
      error: result.error,
    };
  }

  const buckets = collectEntityIds(result.jobs);
  const maps = await fetchEntityMaps(userId, buckets);
  const enrichedJobs = result.jobs.map((job) => enrichJobItem(job, maps));

  return {
    jobs: enrichedJobs,
    offline: result.offline,
    error: result.error,
  };
}

/**
 * Server Action alias for listJobs.
 */
export async function listUserJobsAction(
  options?: ListJobsOptions,
): Promise<ListJobsResult> {
  return listJobs(options);
}
