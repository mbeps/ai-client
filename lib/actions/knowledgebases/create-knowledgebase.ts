"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import type { KnowledgebaseRow } from "@/types/knowledgebase-row";
import { createKnowledgebaseSchema } from "@/schemas/knowledgebase";
import { resolveEmbeddingProvider } from "@/lib/chat/resolve-provider";
import { z } from "zod";

export async function createKnowledgebase(
  data: z.infer<typeof createKnowledgebaseSchema>,
): Promise<KnowledgebaseRow> {
  const session = await requireSession();

  // Verify embedding configuration BEFORE creating the record
  await resolveEmbeddingProvider(session.user.id);

  const validated = createKnowledgebaseSchema.parse(data);

  const [row] = await db
    .insert(knowledgebase)
    .values({
      name: validated.name,
      description: validated.description ?? null,
      userId: session.user.id,
      indexStatus: "ready",
      lastIndexedAt: null,
    })
    .returning();

  return row;
}
