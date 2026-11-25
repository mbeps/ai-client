"use server";

import type { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { updateProjectForUser } from "@/lib/projects/project-service";
import type { updateProjectSchema } from "@/schemas/project/project";
import type { CommonError } from "@/types/error/common-error";
import type { ProjectRow } from "@/types/project/project-row";
import type { Result } from "@/types/result";

/**
 * Updates an existing project with partial field updates.
 *
 * @param id - UUID of the project to update; must be owned by the authenticated user.
 * @param data - Partial project update object.
 * @returns Result wrapping the updated `ProjectRow`.
 */
export const updateProject = defineAction(
  async (
    id: string,
    data: z.input<typeof updateProjectSchema>,
  ): Promise<Result<ProjectRow, CommonError>> => {
    const session = await requireSession();
    return updateProjectForUser(session.user.id, id, data);
  },
);
