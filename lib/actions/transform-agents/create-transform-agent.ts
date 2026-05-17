"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schema";
import { createTransformAgentSchema } from "@/schemas/transform-agent";
import type { TransformAgentRow } from "@/types/transform-agent-row";
import { z } from "zod";

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
      requiresFileUpload: validated.requiresFileUpload,
      steps: JSON.stringify(validated.steps ?? []),
      userId: session.user.id,
    })
    .returning();

  return row;
}
