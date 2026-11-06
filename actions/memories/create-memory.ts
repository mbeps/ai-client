"use server";

import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { saveMemoryForUser } from "@/lib/memory/save-memory-for-user";
import { fail } from "@/lib/result/fail";
import {
  type CreateMemoryInput,
  createMemorySchema,
} from "@/schemas/memory/memory";
import type { CommonError } from "@/types/error/common-error";
import type { Memory } from "@/types/memory/memory";
import type { Result } from "@/types/result";

/**
 * Creates a new memory item for the authenticated user.
 *
 * @param input - CreateMemoryInput containing memory content
 * @returns Result wrapping the created Memory object
 * @author Maruf Bepary
 */
export const createMemory = defineAction(
  async (input: CreateMemoryInput): Promise<Result<Memory, CommonError>> => {
    const session = await requireSession();
    const parsed = createMemorySchema.safeParse(input);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
      });
    }

    return saveMemoryForUser(session.user.id, parsed.data.content);
  },
);
