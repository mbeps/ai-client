"use server";

import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { getOwnedResource } from "@/lib/db/get-owned-resource";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

/**
 * Fetches a single transform run with its full execution details for the authenticated user.
 * Validates run ownership before returning data.
 * Returns input, output, status, and execution metadata.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the run to retrieve; must be associated with an agent owned by the authenticated user.
 * @returns The transform run record with all execution details.
 * @author Maruf Bepary
 */
export const getTransformRun = defineAction(
  async (id: string): Promise<Result<TransformRunRow | null, CommonError>> => {
    const session = await requireSession();
    const run = await getOwnedResource<TransformRunRow>(
      transformRun,
      id,
      session.user.id,
    );
    return ok(run);
  },
);
