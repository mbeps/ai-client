"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/routes";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { deleteMemoriesForUser } from "@/lib/memory/delete-memories-for-user";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import {
  type DeleteMemoriesInput,
  deleteMemoriesSchema,
} from "@/schemas/memory/memory";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Deletes one or multiple memory items owned by the authenticated user.
 *
 * @param input - DeleteMemoriesInput containing array of memory IDs
 * @returns Result wrapping void
 * @author Maruf Bepary
 */
export const deleteMemories = defineAction(
  async (input: DeleteMemoriesInput): Promise<Result<void, CommonError>> => {
    const session = await requireSession();
    const parsed = deleteMemoriesSchema.safeParse(input);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
      });
    }

    await deleteMemoriesForUser(session.user.id, parsed.data.ids);

    revalidatePath(ROUTES.SETTINGS.MEMORY.path);

    return ok(undefined);
  },
);
