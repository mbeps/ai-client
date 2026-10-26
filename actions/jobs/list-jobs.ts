"use server";

import { and, eq, inArray } from "drizzle-orm";
import { ROUTES } from "@/config/routes";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import {
  transformAgent,
  transformRun,
} from "@/drizzle/schemas/transform-agent-schema";
import { workflowTranslation } from "@/drizzle/schemas/workflow-schema";
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

/**
 * Buckets of collected entity identifiers partitioned by entity type.
 *
 * @author Maruf Bepary
 */
interface EntityIdBuckets {
  chatIds: Set<string>;
  transformRunIds: Set<string>;
  translationIds: Set<string>;
  kbDocIds: Set<string>;
  kbIds: Set<string>;
}

/**
 * Chat entity summary projected from database for job display.
 *
 * @author Maruf Bepary
 */
interface ChatEntity {
  id: string;
  title: string;
  projectId: string | null;
}

/**
 * Transformation entity summary projected from database for job display.
 *
 * @author Maruf Bepary
 */
interface TransformEntity {
  id: string;
  agentId: string;
  agentName: string | null;
}

/**
 * Translation workflow entity summary projected from database for job display.
 *
 * @author Maruf Bepary
 */
interface TranslationEntity {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
}

/**
 * Knowledge base document summary projected from database for job display.
 *
 * @author Maruf Bepary
 */
interface KbDocEntity {
  id: string;
  name: string;
  kbId: string;
}

/**
 * Knowledge base collection summary projected from database for job display.
 *
 * @author Maruf Bepary
 */
interface KbEntity {
  id: string;
  name: string;
}

/**
 * Pre-fetched lookup maps for enriching job items with entity names and URLs.
 *
 * @author Maruf Bepary
 */
interface EntityMaps {
  chatMap: Map<string, ChatEntity>;
  transformMap: Map<string, TransformEntity>;
  translationMap: Map<string, TranslationEntity>;
  kbDocMap: Map<string, KbDocEntity>;
  kbMap: Map<string, KbEntity>;
}

/**
 * Collects unique entity IDs per job type for batched database queries.
 *
 * @param jobs - List of raw job items to extract entity IDs from
 * @returns Bucket map containing ID sets for each entity category
 * @author Maruf Bepary
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
 *
 * @param userId - ID of current authenticated user to scope queries
 * @param buckets - Bucket sets containing IDs to look up
 * @returns Pre-populated entity lookup maps
 * @author Maruf Bepary
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

/**
 * Enriches a chat job item with chat title and navigation URL.
 *
 * @param job - Raw job item
 * @param entity - Pre-fetched chat entity if still existing
 * @returns Enriched job item
 * @author Maruf Bepary
 */
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

/**
 * Enriches a transformation job item with agent name and run history URL.
 *
 * @param job - Raw job item
 * @param entity - Pre-fetched transformation entity if still existing
 * @returns Enriched job item
 * @author Maruf Bepary
 */
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

/**
 * Enriches a translation job item with source/target language pair subtitles.
 *
 * @param job - Raw job item
 * @param entity - Pre-fetched translation entity if still existing
 * @returns Enriched job item
 * @author Maruf Bepary
 */
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

/**
 * Enriches a knowledge base document ingestion job item with document name.
 *
 * @param job - Raw job item
 * @param entity - Pre-fetched document entity if still existing
 * @returns Enriched job item
 * @author Maruf Bepary
 */
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

/**
 * Enriches a knowledge base reindexing job item with knowledge base collection name.
 *
 * @param job - Raw job item
 * @param entity - Pre-fetched knowledge base entity if still existing
 * @returns Enriched job item
 * @author Maruf Bepary
 */
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

/**
 * Enriches an individual job item by looking up its associated entity in pre-fetched maps.
 *
 * @param job - Raw job item
 * @param maps - Pre-populated entity lookup maps
 * @returns Enriched job item with navigation URLs and display titles
 * @author Maruf Bepary
 */
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
