"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import type { AssistantRow } from "@/types/assistant-row";
import { createAssistantSchema } from "@/schemas/assistant";
import { z } from "zod";

/**
 * Creates a new AI assistant persona for the authenticated user.
 * Validates input against createAssistantSchema and inserts a new assistant record with name, description, prompt, and avatar.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Assistant configuration object validated against createAssistantSchema (name required; description, prompt, avatar optional).
 * @returns The newly created assistant record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation (e.g., name is missing).
 * @see updateAssistant to modify an existing assistant.
 * @see deleteAssistant to remove an assistant.
 * @author Maruf Bepary
 */
export async function createAssistant(
  data: z.infer<typeof createAssistantSchema>,
): Promise<AssistantRow> {
  const session = await requireSession();

  // Validate inputs
  const validated = createAssistantSchema.parse(data);

  const [row] = await db
    .insert(assistant)
    .values({
      name: validated.name,
      description: validated.description ?? null,
      prompt: validated.prompt ?? null,
      avatar: validated.avatar ?? null,
      userId: session.user.id,
    })
    .returning();

  return row;
}
