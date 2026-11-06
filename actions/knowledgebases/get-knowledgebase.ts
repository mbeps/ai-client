"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";
import type { Result } from "@/types/result";

/**
 * Fetches a single knowledge base with its metadata and index status for the authenticated user.
 * Validates knowledge base ownership before returning data.
 * Use this to retrieve current indexing status or knowledge base details.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the knowledge base to retrieve; must be owned by the authenticated user.
 * @returns Result containing the knowledge base record with name, description, and index status.
 * @see listKnowledgebases to fetch all knowledge bases.
 * @see listDocuments to fetch documents in this knowledge base.
 * @author Maruf Bepary
 */
export const getKnowledgebase = defineAction(
  async (id: string): Promise<Result<KnowledgebaseRow, CommonError>> => {
    const session = await requireSession();

    const [row] = await db
      .select({
        id: knowledgebase.id,
        userId: knowledgebase.userId,
        name: knowledgebase.name,
        description: knowledgebase.description,
        indexStatus: knowledgebase.indexStatus,
        lastIndexedAt: knowledgebase.lastIndexedAt,
        createdAt: knowledgebase.createdAt,
        updatedAt: knowledgebase.updatedAt,
      })
      .from(knowledgebase)
      .where(
        and(
          eq(knowledgebase.id, id),
          eq(knowledgebase.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(row);
  },
);
