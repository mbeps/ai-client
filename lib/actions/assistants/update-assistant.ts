"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { AssistantRow } from "@/types/assistant/assistant-row";
import { updateAssistantSchema } from "@/schemas/assistant/assistant";
import { z } from "zod";

/**
 * Updates an existing AI assistant's metadata, description, prompt, tools, or avatar.
 * Validates all inputs and enforces ownership check before updating database record.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the assistant to update; must be owned by the authenticated user.
 * @param data - Partial assistant update object (name, description, prompt, tools, avatar fields).
 * @returns The updated assistant record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if id is not a valid UUID format.
 * @throws ZodError if data fails schema validation against updateAssistantSchema.
 * @throws Error if assistant is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createAssistant to create a new assistant.
 * @see deleteAssistant to remove an assistant.
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
      tools: validatedData.tools ?? [],
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
