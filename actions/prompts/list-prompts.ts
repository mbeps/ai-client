"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schemas/prompt-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { PromptRow } from "@/types/prompt/prompt-row";
import type { Result } from "@/types/result";

/**
 * Fetches all saved prompts for the authenticated user, ordered by most recently created first.
 * Use this to display available shortcuts in command palettes or prompt editors.
 * Performs automatic ownership check via session validation.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Result wrapping array of all user's prompts sorted by createdAt descending.
 * @see createPrompt to create a new reusable prompt.
 * @see deletePrompt to remove a prompt.
 * @author Maruf Bepary
 */
export const listPrompts = defineAction(
  async (): Promise<Result<PromptRow[], CommonError>> => {
    const session = await requireSession();

    const rows = await db
      .select()
      .from(prompt)
      .where(eq(prompt.userId, session.user.id))
      .orderBy(desc(prompt.updatedAt));

    return ok(rows);
  },
);
