"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import type { KnowledgebaseRow } from "@/types/knowledgebase-row";
import { createKnowledgebaseSchema } from "@/schemas/knowledgebase";
import { z } from "zod";

export async function createKnowledgebase(
  data: z.infer<typeof createKnowledgebaseSchema>,
): Promise<KnowledgebaseRow> {
  const session = await requireSession();

  const validated = createKnowledgebaseSchema.parse(data);

  const [row] = await db
    .insert(knowledgebase)
    .values({
      name: validated.name,
      description: validated.description ?? null,
      userId: session.user.id,
    })
    .returning();

  return row;
}
