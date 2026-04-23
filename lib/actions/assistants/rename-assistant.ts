"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { AssistantRow } from "@/types/assistant-row";
import { renameAssistantSchema } from "@/schemas/assistant";
import { z } from "zod";

/**
 * Renames an AI assistant persona with ownership check.
 *
 * @param assistantId - Unique identifier of the assistant.
 * @param name - The new display name for the assistant.
 * @returns The updated assistant record.
 * @author Maruf Bepary
 */
export async function renameAssistant(
  assistantId: string,
  name: string,
): Promise<AssistantRow> {
  const session = await requireSession();

  // Validate inputs
  const validatedId = z.string().uuid().parse(assistantId);
  const { name: validatedName } = renameAssistantSchema.parse({ name });

  const [updated] = await db
    .update(assistant)
    .set({ name: validatedName, updatedAt: new Date() })
    .where(
      and(eq(assistant.id, validatedId), eq(assistant.userId, session.user.id)),
    )
    .returning();

  if (!updated) throw new Error("Not Found");

  return updated;
}
