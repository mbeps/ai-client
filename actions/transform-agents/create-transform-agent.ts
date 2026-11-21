"use server";

import type { z } from "zod";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schemas/transform-agent-schema";
import {
  type SubagentLinkTx,
  validateTargetSubagentIds,
  withSubagentLinkLock,
} from "@/lib/agents/validate-subagent-links";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { filterOwnedKbIds } from "@/lib/knowledgebases/filter-owned-kb-ids";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { createTransformAgentSchema } from "@/schemas/workflows/transform-agent";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";

/**
 * Creates a new transform agent for the authenticated user.
 * Validates input against createTransformAgentSchema and inserts a new agent record with configuration.
 * Serializes workflow steps to JSON before storing.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Agent configuration object validated against createTransformAgentSchema (name, steps, tools, knowledgeBaseIds required).
 * @returns Result wrapping newly created transform agent record.
 * @author Maruf Bepary
 */
export const createTransformAgent = defineAction(
  async (
    data: z.infer<typeof createTransformAgentSchema>,
  ): Promise<Result<TransformAgentRow, CommonError>> => {
    const session = await requireSession();
    const parsed = createTransformAgentSchema.safeParse(data);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid agent configuration",
        issues: parsed.error.issues.map((i) => i.message),
      });
    }
    const validated = parsed.data;
    const uniqueKbIds = [
      ...new Set(validated.knowledgeBaseIds.filter(Boolean)),
    ];
    if (uniqueKbIds.length > 0) {
      const ownedKbIds = await filterOwnedKbIds(session.user.id, uniqueKbIds);
      if (ownedKbIds.length !== uniqueKbIds.length) {
        return fail({
          code: ERROR_CODE.FORBIDDEN,
          message: "One or more knowledge bases are not accessible",
        });
      }
    }

    const subagentIds = validated.subagentIds ?? [];
    const insertTransformAgent = async (executor: SubagentLinkTx) => {
      const [inserted] = await executor
        .insert(transformAgent)
        .values({
          name: validated.name,
          description: validated.description ?? null,
          globalContext: validated.globalContext ?? null,
          modelId: validated.modelId ?? null,
          tools: validated.tools,
          skillMode: validated.skillMode,
          skillIds: validated.skillIds,
          knowledgeBaseIds: validated.knowledgeBaseIds,
          subagentIds,
          requiresFileUpload: validated.requiresFileUpload,
          steps: JSON.stringify(validated.steps),
          userId: session.user.id,
        })
        .returning();
      return inserted;
    };

    let row: TransformAgentRow;
    if (subagentIds.length > 0) {
      const txResult = await withSubagentLinkLock(
        session.user.id,
        async (tx) => {
          const linkCheck = await validateTargetSubagentIds(
            session.user.id,
            subagentIds,
            undefined,
            tx,
          );
          if (!linkCheck.ok) {
            return linkCheck;
          }
          return ok((await insertTransformAgent(tx)) as TransformAgentRow);
        },
      );
      if (!txResult.ok) {
        return txResult;
      }
      row = txResult.value;
    } else {
      row = (await insertTransformAgent(db)) as TransformAgentRow;
    }

    return ok(row);
  },
);
