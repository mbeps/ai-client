"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { updateTransformAgentSchema } from "@/schemas/workflows/transform-agent";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";
import { z } from "zod";

/**
 * Updates an existing transform agent with partial field updates.
 * Validates inputs and enforces ownership check before updating database record.
 * Serializes workflow steps to JSON before storing if provided.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the agent to update; must be owned by the authenticated user.
 * @param data - Partial agent update object (name, description, globalContext, modelId, tools, knowledgeBaseIds, steps, requiresFileUpload fields).
 * @returns The updated agent record.
 * @throws Error if session is not authenticated.
 * @throws ZodError if id is not a valid UUID format.
 * @throws ZodError if data fails schema validation against updateTransformAgentSchema.
 * @throws Error if agent is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createTransformAgent to create a new agent.
 * @author Maruf Bepary
 */
export async function updateTransformAgent(
  id: string,
  data: z.infer<typeof updateTransformAgentSchema>,
): Promise<TransformAgentRow> {
  const session = await requireSession();
  const validated = updateTransformAgentSchema.parse(data);

  const values: Record<string, unknown> = {};
  if (validated.name !== undefined) values.name = validated.name;
  if (validated.description !== undefined)
    values.description = validated.description ?? null;
  if (validated.globalContext !== undefined)
    values.globalContext = validated.globalContext ?? null;
  if (validated.modelId !== undefined)
    values.modelId = validated.modelId ?? null;
  if (validated.tools !== undefined) values.tools = validated.tools;
  if (validated.knowledgeBaseIds !== undefined)
    values.knowledgeBaseIds = validated.knowledgeBaseIds;
  if (validated.requiresFileUpload !== undefined)
    values.requiresFileUpload = validated.requiresFileUpload;
  if (validated.steps !== undefined)
    values.steps = JSON.stringify(validated.steps);

  const [row] = await db
    .update(transformAgent)
    .set(values)
    .where(
      and(
        eq(transformAgent.id, id),
        eq(transformAgent.userId, session.user.id),
      ),
    )
    .returning();

  if (!row) throw new Error("Not Found");
  return row;
}
