"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  type WorkflowTranslation,
  workflowTranslation,
} from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Server action to fetch the user's latest translation run.
 * Used for rehydrating state when the user visits or refreshes the translation page.
 *
 * @returns Result wrapping most recent WorkflowTranslation record or null.
 * @author Maruf Bepary
 */
export const getLatestTranslationAction = defineAction(
  async (): Promise<Result<WorkflowTranslation | null, CommonError>> => {
    const session = await requireSession();

    const [row] = await db
      .select()
      .from(workflowTranslation)
      .where(eq(workflowTranslation.userId, session.user.id))
      .orderBy(desc(workflowTranslation.createdAt))
      .limit(1);

    return ok(row ?? null);
  },
);
