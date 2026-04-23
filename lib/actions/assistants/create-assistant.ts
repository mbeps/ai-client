"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import type { AssistantRow } from "@/types/assistant-row";
import { createAssistantSchema } from "@/schemas/assistant";
import { z } from "zod";

/**
 * Creates a new AI assistant persona for the current user.
 *
 * @param data - Assistant configuration (name, description, system prompt, avatar).
 * @returns The newly created assistant record.
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
