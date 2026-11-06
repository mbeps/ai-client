"use server";

import { assistant } from "@/drizzle/schemas/assistant-schema";
import { listOwnedResources } from "@/lib/db/utils/list-owned-resources";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { AssistantRow } from "@/types/assistant/assistant-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Fetches all AI personas (assistants) for the authenticated user, ordered by most recently updated first.
 * Use this to display available assistants in selection dropdowns or list views. Performs automatic ownership check via session validation.
 *
 * @returns Result wrapping array of all user's assistants sorted by updatedAt descending
 * @author Maruf Bepary
 */
export const listAssistants = defineAction(
  async (): Promise<Result<AssistantRow[], CommonError>> => {
    const rows = await listOwnedResources(assistant);
    return ok(rows);
  },
);
