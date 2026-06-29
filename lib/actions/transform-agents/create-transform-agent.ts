"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schema";
import { createTransformAgentSchema } from "@/schemas/workflows/transform-agent";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";
import { z } from "zod";

/**
 * Creates a new transform agent for the authenticated user.
 * Validates input against createTransformAgentSchema and inserts a new agent record with configuration.
 * Serializes workflow steps to JSON before storing.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Agent configuration object validated against createTransformAgentSchema (name, steps, tools, knowledgeBaseIds required).
 * @returns The newly created transform agent record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation (e.g., name is missing).
 * @throws Error if database insertion fails due to constraints or connection issues.
 * @see listTransformAgents to fetch all agents.
 * @see updateTransformAgent to modify an agent.
 * @author Maruf Bepary
 */
export async function createTransformAgent(
  data: z.infer<typeof createTransformAgentSchema>,
): Promise<TransformAgentRow> {
  const session = await requireSession();
  const validated = createTransformAgentSchema.parse(data);

  const [row] = await db
    .insert(transformAgent)
    .values({
      name: validated.name,
      description: validated.description ?? null,
      globalContext: validated.globalContext ?? null,
      modelId: validated.modelId ?? null,
      tools: validated.tools,
      knowledgeBaseIds: validated.knowledgeBaseIds,
      requiresFileUpload: validated.requiresFileUpload,
      steps: JSON.stringify(validated.steps ?? []),
      userId: session.user.id,
    })
    .returning();

  return row;
}
