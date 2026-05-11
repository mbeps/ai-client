"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase, kbDocument } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { KbDocumentRow } from "@/types/kb-document-row";
import { addDocumentSchema } from "@/schemas/knowledgebase";
import { z } from "zod";

export async function addDocument(
  data: z.infer<typeof addDocumentSchema>,
): Promise<KbDocumentRow> {
  const session = await requireSession();

  const validated = addDocumentSchema.parse(data);

  const [kb] = await db
    .select({ id: knowledgebase.id })
    .from(knowledgebase)
    .where(
      and(
        eq(knowledgebase.id, validated.kbId),
        eq(knowledgebase.userId, session.user.id),
      ),
    );

  if (!kb) throw new Error("Knowledgebase not found");

  const [row] = await db
    .insert(kbDocument)
    .values({
      kbId: validated.kbId,
      userId: session.user.id,
      name: validated.name,
      mimeType: validated.mimeType,
      size: validated.size,
      s3Key: validated.s3Key,
      status: "pending",
    })
    .returning();

  return row;
}
