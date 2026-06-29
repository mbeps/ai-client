"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { PromptRow } from "@/types/prompt/prompt-row";
import { updatePromptSchema } from "@/schemas/prompt/prompt";
import { z } from "zod";

/**
 * Updates an existing prompt with partial field updates (shortcut, title, content).
 * Validates all inputs and enforces ownership check before updating database record.
 * Shortcut changes immediately affect slash command triggers in chat interface.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the prompt to update; must be owned by the authenticated user.
 * @param data - Partial prompt update object (shortcut, title, content fields).
 * @returns The updated prompt record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if id is not a valid UUID format.
 * @throws ZodError if data fails schema validation against updatePromptSchema.
 * @throws Error if prompt is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createPrompt to create a new prompt.
 * @see deletePrompt to remove a prompt.
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
