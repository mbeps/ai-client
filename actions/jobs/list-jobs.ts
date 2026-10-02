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

  // Collect unique entity IDs per type for batched database queries
  const chatIds = new Set<string>();
  const transformRunIds = new Set<string>();
  const translationIds = new Set<string>();
  const kbDocIds = new Set<string>();
  const kbIds = new Set<string>();

  for (const job of result.jobs) {
    if (!job.entityId) continue;
    switch (job.type) {
      case "chat":
        chatIds.add(job.entityId);
        break;
      case "transform":
        transformRunIds.add(job.entityId);
        break;
      case "translation":
        translationIds.add(job.entityId);
        break;
      case "kb-ingest":
        kbDocIds.add(job.entityId);
        break;
      case "kb-reindex":
        kbIds.add(job.entityId);
        break;
      default:
        break;
    }
  }

  // Execute queries in parallel using inArray only for non-empty arrays
  const [chatRows, transformRows, translationRows, kbDocRows, kbRows] =
    await Promise.all([
      chatIds.size > 0
        ? db
            .select({
              id: chat.id,
              title: chat.title,
              projectId: chat.projectId,
            })
            .from(chat)
            .where(and(inArray(chat.id, [...chatIds]), eq(chat.userId, userId)))
        : Promise.resolve([]),

      transformRunIds.size > 0
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
                inArray(transformRun.id, [...transformRunIds]),
                eq(transformRun.userId, userId),
              ),
            )
        : Promise.resolve([]),

      translationIds.size > 0
        ? db
            .select({
              id: workflowTranslation.id,
              sourceLanguage: workflowTranslation.sourceLanguage,
              targetLanguage: workflowTranslation.targetLanguage,
            })
            .from(workflowTranslation)
            .where(
              and(
                inArray(workflowTranslation.id, [...translationIds]),
                eq(workflowTranslation.userId, userId),
              ),
            )
        : Promise.resolve([]),

      kbDocIds.size > 0
        ? db
            .select({
              id: kbDocument.id,
              name: kbDocument.name,
              kbId: kbDocument.kbId,
            })
            .from(kbDocument)
            .where(
              and(
                inArray(kbDocument.id, [...kbDocIds]),
                eq(kbDocument.userId, userId),
              ),
            )
        : Promise.resolve([]),

      kbIds.size > 0
        ? db
            .select({
              id: knowledgebase.id,
              name: knowledgebase.name,
            })
            .from(knowledgebase)
            .where(
              and(
                inArray(knowledgebase.id, [...kbIds]),
                eq(knowledgebase.userId, userId),
              ),
            )
        : Promise.resolve([]),
    ]);

  const chatMap = new Map(chatRows.map((row) => [row.id, row]));
  const transformMap = new Map(transformRows.map((row) => [row.id, row]));
  const translationMap = new Map(translationRows.map((row) => [row.id, row]));
  const kbDocMap = new Map(kbDocRows.map((row) => [row.id, row]));
  const kbMap = new Map(kbRows.map((row) => [row.id, row]));

  // Enrich each job item with fresh DB metadata and handle deleted entities
  const enrichedJobs: JobItem[] = result.jobs.map((job) => {
    const enriched: JobItem = { ...job };
    if (!enriched.entityId) {
      return enriched;
    }

    switch (enriched.type) {
      case "chat": {
        const entity = chatMap.get(enriched.entityId);
        if (!entity) {
          enriched.entityDeleted = true;
          enriched.title = "Chat (Deleted or Unavailable)";
          enriched.url = undefined;
        } else {
          enriched.title = entity.title || enriched.title;
          enriched.url = entity.projectId
            ? ROUTES.PROJECTS.chat(entity.projectId, entity.id)
            : ROUTES.CHATS.detail(entity.id);
          enriched.entityDeleted = false;
        }
        break;
      }

      case "transform": {
        const entity = transformMap.get(enriched.entityId);
        if (!entity) {
          enriched.entityDeleted = true;
          enriched.title = "Transform (Deleted or Unavailable)";
          enriched.url = undefined;
        } else {
          if (entity.agentName) {
            enriched.title = entity.agentName;
          }
          enriched.url = ROUTES.WORKFLOWS.TRANSFORM.runs(
            entity.agentId,
            entity.id,
          );
          enriched.entityDeleted = false;
        }
        break;
      }

      case "translation": {
        const entity = translationMap.get(enriched.entityId);
        if (!entity) {
          enriched.entityDeleted = true;
          enriched.title = "Translation (Deleted or Unavailable)";
          enriched.url = undefined;
        } else {
          enriched.subtitle = `${entity.sourceLanguage} → ${entity.targetLanguage}`;
          enriched.url = ROUTES.WORKFLOWS.TRANSLATION.path;
          enriched.entityDeleted = false;
        }
        break;
      }

      case "kb-ingest": {
        const entity = kbDocMap.get(enriched.entityId);
        if (!entity) {
          enriched.entityDeleted = true;
          enriched.title = "Document (Deleted or Unavailable)";
          enriched.url = undefined;
        } else {
          enriched.title = entity.name;
          enriched.url = ROUTES.KNOWLEDGEBASES.detail(entity.kbId);
          enriched.entityDeleted = false;
        }
        break;
      }

      case "kb-reindex": {
        const entity = kbMap.get(enriched.entityId);
        if (!entity) {
          enriched.entityDeleted = true;
          enriched.title = "Knowledge Base (Deleted or Unavailable)";
          enriched.url = undefined;
        } else {
          enriched.title = entity.name;
          enriched.url = ROUTES.KNOWLEDGEBASES.detail(entity.id);
          enriched.entityDeleted = false;
        }
        break;
      }

      default:
        break;
    }

    return enriched;
  });

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
