"use server";

import type { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { createProjectForUser } from "@/lib/projects/project-service";
import type { createProjectSchema } from "@/schemas/project/project";
import type { CommonError } from "@/types/error/common-error";
import type { ProjectRow } from "@/types/project/project-row";
import type { Result } from "@/types/result";

/**
 * Creates a new project for the authenticated user.
 *
 * @param data - Project configuration object validated against `createProjectSchema`.
 * @returns Result wrapping the newly created `ProjectRow`.
 */
export const createProject = defineAction(
  async (
    data: z.input<typeof createProjectSchema>,
  ): Promise<Result<ProjectRow, CommonError>> => {
    const session = await requireSession();
    return createProjectForUser(session.user.id, data);
  },
);
