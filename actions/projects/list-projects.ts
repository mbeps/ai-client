"use server";

import { desc } from "drizzle-orm";
import { project } from "@/drizzle/schemas/project-schema";
import { listOwnedResources } from "@/lib/db/utils/list-owned-resources";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { ProjectRow } from "@/types/project/project-row";
import type { Result } from "@/types/result";

/**
 * Fetches all projects for the authenticated user, ordered by most recently updated first.
 * Use this to display available projects in selection dropdowns or sidebar lists.
 * Performs automatic ownership check via session validation.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Result wrapping array of all user's projects sorted by updatedAt descending.
 * @see createProject to create a new project.
 * @see getProject to fetch a single project with all details.
 * @author Maruf Bepary
 */
export const listProjects = defineAction(
  async (): Promise<Result<ProjectRow[], CommonError>> => {
    const rows = await listOwnedResources(project, {
      orderBy: (t) => [desc(t.updatedAt)],
    });
    return ok(rows);
  },
);
