import { and, eq, ne } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { workflowRun } from "@/drizzle/schemas/workflow-schema";

/**
 * Updates a non-failed workflow run record and stamps `updatedAt`.
 * Returns `{ id }` rows matched so callers can detect cancelled/failed runs.
 */
export async function updateActiveWorkflowRun(
  runId: string,
  values: Partial<typeof workflowRun.$inferInsert>,
): Promise<Array<{ id: string }>> {
  return db
    .update(workflowRun)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(workflowRun.id, runId), ne(workflowRun.status, "failed")))
    .returning({ id: workflowRun.id });
}
