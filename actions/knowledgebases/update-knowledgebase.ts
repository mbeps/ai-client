"use server";

import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { updateEntityFactory } from "@/lib/factories/update-entity-factory";
import { fail } from "@/lib/result/fail";
import { updateKnowledgebaseSchema } from "@/schemas/knowledgebase/knowledgebase";
import type { CommonError } from "@/types/error/common-error";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";
import type { Result } from "@/types/result";

const baseUpdateKnowledgebase = updateEntityFactory<
  z.infer<typeof updateKnowledgebaseSchema>,
  KnowledgebaseRow
>({
  table: knowledgebase,
  schema: updateKnowledgebaseSchema,
  mapValues: (data) => {
    const values: Record<string, unknown> = {};
    if (data.name !== undefined) values.name = data.name;
    if (data.description !== undefined) values.description = data.description;
    if (data.metadataModelId !== undefined) {
      values.metadataModelId = data.metadataModelId;
    }
    return values;
  },
});

/**
 * Updates an existing knowledge base with partial field updates (name, description, metadataModelId).
 * Validates ownership and chat capability of `metadataModelId` when provided before delegating update.
 *
 * @param id - UUID of the knowledge base to update; must be owned by the authenticated user.
 * @param data - Partial knowledge base update object.
 * @returns Result wrapping the updated knowledge base record.
 * @author Maruf Bepary
 */
export const updateKnowledgebase = defineAction(
  async (
    id: string,
    data: z.infer<typeof updateKnowledgebaseSchema>,
  ): Promise<Result<KnowledgebaseRow, CommonError>> => {
    if (data.metadataModelId) {
      const session = await requireSession();
      const [model] = await db
        .select({ id: aiModel.id })
        .from(aiModel)
        .where(
          and(
            eq(aiModel.id, data.metadataModelId),
            eq(aiModel.userId, session.user.id),
            inArray(aiModel.modelType, ["chat", "both"]),
          ),
        );

      if (!model) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Not Found",
        });
      }
    }

    return baseUpdateKnowledgebase(id, data);
  },
);
