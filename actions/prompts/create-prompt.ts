"use server";

import type { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { createPromptForUser } from "@/lib/prompts/prompt-service";
import type { createPromptSchema } from "@/schemas/prompt/prompt";
import type { CommonError } from "@/types/error/common-error";
import type { PromptRow } from "@/types/prompt/prompt-row";
import type { Result } from "@/types/result";

/**
 * Creates a new reusable prompt for slash commands (/shortcut) for the authenticated user.
 *
 * @param data - Prompt configuration object validated against `createPromptSchema`.
 * @returns The newly created prompt record with all fields populated.
 */
export const createPrompt = defineAction(
  async (
    data: z.infer<typeof createPromptSchema>,
  ): Promise<Result<PromptRow, CommonError>> => {
    const session = await requireSession();
    return createPromptForUser(session.user.id, data);
  },
);
