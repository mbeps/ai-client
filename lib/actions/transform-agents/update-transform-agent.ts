"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { updateTransformAgentSchema } from "@/schemas/transform-agent";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";
import { z } from "zod";

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

  if (!row) throw new Error("Agent not found");
  return row;
}
