"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { AssistantRow } from "@/types/assistant-row";
import { updateAssistantSchema } from "@/schemas/assistant";
import { z } from "zod";

/**
 * Updates an existing assistant's metadata or persona prompt.
 *
 * @param id - Unique identifier of the assistant.
 * @param data - Fields to update.
 * @returns The updated assistant record.
 * @author Maruf Bepary
 */
export async function updateAssistant(
  id: string,
  data: z.infer<typeof updateAssistantSchema>,
): Promise<AssistantRow> {
  const session = await requireSession();

  // Validate inputs
  const validatedId = z.string().uuid().parse(id);
  const validatedData = updateAssistantSchema.parse(data);

  const [row] = await db
    .update(assistant)
    .set({
      name: validatedData.name,
      description: validatedData.description ?? null,
      prompt: validatedData.prompt ?? null,
      avatar: validatedData.avatar ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(assistant.id, validatedId), eq(assistant.userId, session.user.id)),
    )
    .returning();

  if (!row) throw new Error("Not Found");

  return row;
}
