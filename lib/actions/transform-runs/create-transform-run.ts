"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformAgent, transformRun } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { createTransformRunSchema } from "@/schemas/workflows/transform-agent";
import type { TransformRunRow } from "@/types/transform/transform-run-row";
import { z } from "zod";

/**
 * Creates a new transform run execution record for the authenticated user.
 * Validates that the agent belongs to the user and inserts a new run record with initial status.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Run configuration object validated against createTransformRunSchema (agentId, input, and other execution parameters).
 * @returns The newly created transform run record with all fields populated and initial status.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation (e.g., agentId is missing).
 * @throws Error if agent does not exist or user does not own it (returns "Not Found").
 * @throws Error if database insertion fails due to constraints or connection issues.
 * @see listTransformRuns to fetch all runs for an agent.
 * @see getTransformRun to fetch details for a specific run.
 * @author Maruf Bepary
 */
export async function createTransformRun(
  data: z.infer<typeof createTransformRunSchema>,
): Promise<TransformRunRow> {
  const session = await requireSession();
  const validated = createTransformRunSchema.parse(data);

  const agents = await db
    .select()
    .from(transformAgent)
    .where(
      and(
        eq(transformAgent.id, validated.agentId),
        eq(transformAgent.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!agents[0]) throw new Error("Not Found");

  const [row] = await db
    .insert(transformRun)
    .values({
      agentId: validated.agentId,
      userId: session.user.id,
      status: "pending",
      dryRun: validated.dryRun ?? false,
      inputAttachmentIds: Array.isArray(validated.inputAttachmentIds)
        ? validated.inputAttachmentIds
        : validated.inputAttachmentIds
          ? [validated.inputAttachmentIds]
          : [],
      outputAttachmentIds: [],
    })
    .returning();

  return row;
}
