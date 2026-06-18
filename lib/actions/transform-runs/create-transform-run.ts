"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformAgent, transformRun } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { createTransformRunSchema } from "@/schemas/workflows/transform-agent";
import type { TransformRunRow } from "@/types/transform/transform-run-row";
import { z } from "zod";

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
