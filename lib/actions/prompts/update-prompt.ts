"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { PromptRow } from "@/types/prompt-row";
import { updatePromptSchema } from "@/schemas/prompt";
import { z } from "zod";

/**
 * Updates an existing prompt's metadata or template content.
 *
 * @param id - Unique identifier of the prompt.
 * @param data - Fields to update.
 * @returns The updated prompt record.
 * @author Maruf Bepary
 */
export async function updatePrompt(
  id: string,
  data: z.infer<typeof updatePromptSchema>,
): Promise<PromptRow> {
  const session = await requireSession();

  // Validate inputs
  const validatedId = z.string().uuid().parse(id);
  const validatedData = updatePromptSchema.parse(data);

  const [row] = await db
    .update(prompt)
    .set({
      title: validatedData.title,
      shortcut: validatedData.shortcut,
      content: validatedData.content,
      updatedAt: new Date(),
    })
    .where(and(eq(prompt.id, validatedId), eq(prompt.userId, session.user.id)))
    .returning();

  if (!row) throw new Error("Not Found");

  return row;
}
