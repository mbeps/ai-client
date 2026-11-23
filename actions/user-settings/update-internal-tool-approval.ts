"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/routes";
import { parseInternalToolApprovals } from "@/config/tool-approval";
import { INTERNAL_TOOL_CATALOGUE } from "@/config/tools";
import { db } from "@/drizzle/db";
import { userSettings } from "@/drizzle/schemas/user-settings-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { ToolPermissionMode } from "@/types/tool/approval";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

const log = getLogger(["app", "actions", "user-settings", "tool-approval"]);

const updateInternalToolApprovalSchema = z.object({
  toolName: z.string(),
  approval: z.enum(["ask", "auto", "block"]),
});

/**
 * Updates or resets a user's persistent permission override for a single internal
 * tool (`"auto"`, `"ask"`, or `"block"`). Entries matching the catalogue default
 * are pruned to keep storage minimal.
 *
 * Uses a transaction with row creation (`onConflictDoNothing`) and a `FOR UPDATE`
 * row lock so concurrent updates from the same user serialize safely.
 *
 * @param input - Internal tool name and desired permission mode
 * @returns Result wrapping the updated UserSettingsRow
 */
export const updateInternalToolApproval = defineAction(
  async (input: {
    toolName: string;
    approval: ToolPermissionMode;
  }): Promise<Result<UserSettingsRow, CommonError>> => {
    const session = await requireSession();

    const parsed = updateInternalToolApprovalSchema.safeParse(input);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid input",
      });
    }

    const { toolName, approval } = parsed.data;

    const catalogueEntry = INTERNAL_TOOL_CATALOGUE.find(
      (tool) => tool.name === toolName,
    );
    if (!catalogueEntry) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Unknown internal tool",
      });
    }

    const row = await db.transaction(async (tx) => {
      await tx
        .insert(userSettings)
        .values({ userId: session.user.id })
        .onConflictDoNothing({ target: userSettings.userId });

      const [existing] = await tx
        .select({ internalToolApprovals: userSettings.internalToolApprovals })
        .from(userSettings)
        .where(eq(userSettings.userId, session.user.id))
        .for("update");

      const overrides = parseInternalToolApprovals(
        existing?.internalToolApprovals,
      );

      if (approval === catalogueEntry.defaultApproval) {
        delete overrides[toolName];
      } else {
        overrides[toolName] = approval;
      }

      const serialized =
        Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : null;

      const [updated] = await tx
        .update(userSettings)
        .set({
          internalToolApprovals: serialized,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, session.user.id))
        .returning();

      return updated;
    });

    log.info("Updated internal tool approval override", {
      userId: session.user.id,
      toolName,
      approval,
    });

    revalidatePath(ROUTES.SETTINGS.TOOLS.path);

    return ok(row);
  },
);
