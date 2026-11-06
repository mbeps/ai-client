"use server";

import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { updateMemoryForUser } from "@/lib/memory/update-memory-for-user";
import { fail } from "@/lib/result/fail";
import {
  type UpdateMemoryInput,
  updateMemorySchema,
} from "@/schemas/memory/memory";
import type { CommonError } from "@/types/error/common-error";
import type { Memory } from "@/types/memory/memory";
import type { Result } from "@/types/result";

/**
 * Updates an existing memory item for the authenticated user.
 *
 * @param input - UpdateMemoryInput containing id and content
 * @returns Result wrapping the updated Memory object
 * @author Maruf Bepary
 */
export const updateMemory = defineAction(
  async (input: UpdateMemoryInput): Promise<Result<Memory, CommonError>> => {
    const session = await requireSession();
    const parsed = updateMemorySchema.safeParse(input);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
      });
    }

    return updateMemoryForUser(
      session.user.id,
      parsed.data.id,
      parsed.data.content,
    );
  },
);
