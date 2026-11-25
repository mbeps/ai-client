"use server";

import type { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { updatePromptForUser } from "@/lib/prompts/prompt-service";
import type { updatePromptSchema } from "@/schemas/prompt/prompt";
import type { CommonError } from "@/types/error/common-error";
import type { PromptRow } from "@/types/prompt/prompt-row";
import type { Result } from "@/types/result";

/**
 * Updates an existing prompt with partial field updates.
 *
 * @param id - UUID of the prompt to update; must be owned by the authenticated user.
 * @param data - Partial prompt update object.
 * @returns The Result containing updated prompt record.
 */
export const updatePrompt = defineAction(
  async (
    id: string,
    data: z.infer<typeof updatePromptSchema>,
  ): Promise<Result<PromptRow, CommonError>> => {
    const session = await requireSession();
    return updatePromptForUser(session.user.id, id, data);
  },
);
