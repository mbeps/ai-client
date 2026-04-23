"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import type { PromptRow } from "@/types/prompt-row";
import { createPromptSchema } from "@/schemas/prompt";
import { z } from "zod";

/**
 * Creates a new reusable prompt for slash commands.
 *
 * @param data - Prompt configuration (title, shortcut, content).
 * @returns The newly created prompt record.
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
