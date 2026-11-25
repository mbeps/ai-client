"use server";

import type { z } from "zod";
import type { WorkflowRow } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { updateWorkflowForUser } from "@/lib/workflows/workflow-service";
import type { updateWorkflowSchema } from "@/schemas/workflows/workflow";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Updates workflow settings and atomically replaces nodes and edges inside a transaction when provided.
 */
export const updateWorkflow = defineAction(
  async (
    id: string,
    data: z.input<typeof updateWorkflowSchema>,
  ): Promise<Result<WorkflowRow, CommonError>> => {
    const session = await requireSession();
    return updateWorkflowForUser(session.user.id, id, data);
  },
);
