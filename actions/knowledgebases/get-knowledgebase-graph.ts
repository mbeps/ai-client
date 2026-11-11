"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocumentRelation } from "@/drizzle/schemas/kb-document-relation-schema";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { KbGraphData } from "@/types/knowledgebase/kb-graph-data";
import type { Result } from "@/types/result";

/**
 * Retrieves the complete document relationship graph for a given knowledge base.
 *
 * Verifies that the requesting user owns the knowledge base, queries all ready documents
 * with their metadata (summary, documentType, keyEntities), and retrieves all semantic
 * relationship edges from `kb_document_relation` to power visual graph representations.
 *
 * @async
 * @param kbId - Unique identifier of the knowledge base to inspect
 * @returns Result containing document nodes and interconnecting relationship edges
 * @author Maruf Bepary
 */
export const getKnowledgebaseGraph = defineAction(
  async (kbId: string): Promise<Result<KbGraphData, CommonError>> => {
    const session = await requireSession();

    const [kb] = await db
      .select({ id: knowledgebase.id })
      .from(knowledgebase)
      .where(
        and(
          eq(knowledgebase.id, kbId),
          eq(knowledgebase.userId, session.user.id),
        ),
      );

    if (!kb) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    const [docs, relations] = await Promise.all([
      db
        .select({
          id: kbDocument.id,
          name: kbDocument.name,
          documentType: kbDocument.documentType,
          summary: kbDocument.summary,
          keyEntities: kbDocument.keyEntities,
          chunkCount: kbDocument.chunkCount,
          tokenCount: kbDocument.tokenCount,
        })
        .from(kbDocument)
        .where(and(eq(kbDocument.kbId, kbId), eq(kbDocument.status, "ready"))),
      db
        .select({
          id: kbDocumentRelation.id,
          sourceDocId: kbDocumentRelation.sourceDocId,
          targetDocId: kbDocumentRelation.targetDocId,
          relationType: kbDocumentRelation.relationType,
          reason: kbDocumentRelation.reason,
        })
        .from(kbDocumentRelation)
        .where(eq(kbDocumentRelation.kbId, kbId)),
    ]);

    return ok({
      documents: docs.map((d) => ({
        id: d.id,
        name: d.name,
        documentType: d.documentType ?? "general",
        summary: d.summary ?? "",
        keyEntities: (d.keyEntities as string[]) ?? [],
        chunkCount: d.chunkCount ?? 0,
        tokenCount: d.tokenCount ?? 0,
      })),
      relations: relations.map((r) => ({
        id: r.id,
        sourceDocId: r.sourceDocId,
        targetDocId: r.targetDocId,
        relationType: r.relationType,
        reason: r.reason,
      })),
    });
  },
);
