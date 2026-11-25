"use server";

import type { z } from "zod";
import type { WorkflowRow } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { createWorkflowForUser } from "@/lib/workflows/workflow-service";
import type { createWorkflowSchema } from "@/schemas/workflows/workflow";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Creates a new visual DAG workflow along with its initial nodes and directed edges.
 */
export const createWorkflow = defineAction(
  async (
    data: z.input<typeof createWorkflowSchema>,
  ): Promise<Result<WorkflowRow, CommonError>> => {
    const session = await requireSession();
    return createWorkflowForUser(session.user.id, data);
  },
);
