"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import type { PromptRow } from "@/types/prompt-row";
import { createPromptSchema } from "@/schemas/prompt";
import { z } from "zod";

/**
 * Creates a new reusable prompt for slash commands (/shortcut) for the authenticated user.
 * Validates input against createPromptSchema and inserts a new prompt record; shortcut becomes the trigger for prepending content to AI calls.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Prompt configuration object validated against createPromptSchema (title, shortcut, content all required).
 * @returns The newly created prompt record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation (e.g., required fields missing).
 * @see usePromptCommands hook for triggering prompts in chat UI.
 * @see updatePrompt to modify prompt content or shortcut.
 * @author Maruf Bepary
 */
export async function createPrompt(
  data: z.infer<typeof createPromptSchema>,
): Promise<PromptRow> {
  const session = await requireSession();

  // Validate inputs
  const validated = createPromptSchema.parse(data);

  const [row] = await db
    .insert(prompt)
    .values({
      title: validated.title,
      shortcut: validated.shortcut,
      content: validated.content,
      userId: session.user.id,
    })
    .returning();

  return row;
}
