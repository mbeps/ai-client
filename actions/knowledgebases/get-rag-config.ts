"use server";

import { env, type RagMode } from "@/config/env";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Knowledge Base RAG mode configuration exposed to client pages.
 *
 * @author Maruf Bepary
 */
export type RagConfig = {
  ragMode: RagMode;
  requiresEmbedding: boolean;
};

/**
 * Returns the active server RAG mode and whether embedding models are required.
 *
 * @returns Result containing `{ ragMode, requiresEmbedding }`.
 * @author Maruf Bepary
 */
export const getRagConfig = defineAction(
  async (): Promise<Result<RagConfig, CommonError>> => {
    await requireSession();

    return ok({
      ragMode: env.RAG_MODE,
      requiresEmbedding: env.RAG_MODE !== "file_read",
    });
  },
);
