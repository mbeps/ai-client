import { z } from "zod";
import { isBuiltInAgentId } from "@/config/built-in-agents";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { db } from "@/drizzle/db";
import {
  agent,
  DEFAULT_AGENT_GUARDRAILS,
} from "@/drizzle/schemas/agent-schema";
import {
  type SubagentLinkTx,
  validateAgentCanBecomeOrchestrator,
  validateTargetSubagentIds,
  withSubagentLinkLock,
} from "@/lib/agents/validate-subagent-links";
import { whereOwner } from "@/lib/db/where-owner";
import { ERROR_CODE } from "@/lib/error/error-code";
import { filterOwnedKbIds } from "@/lib/knowledgebases/filter-owned-kb-ids";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { createAgentSchema, updateAgentSchema } from "@/schemas/agent/agent";
import type { AgentRow } from "@/types/agent/agent-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "services", "agent"]);

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) =>
    i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message,
  );
}

function buildAgentUpdateValues(
  data: z.infer<typeof updateAgentSchema>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) values.name = data.name;
  if (data.description !== undefined) values.description = data.description;
  if (data.prompt !== undefined) values.prompt = data.prompt;
  if (data.subagentPrompt !== undefined)
    values.subagentPrompt = data.subagentPrompt;
  if (data.modelId !== undefined) values.modelId = data.modelId;
  if (data.reasoningEffort !== undefined)
    values.reasoningEffort = data.reasoningEffort;
  if (data.knowledgebaseIds !== undefined)
    values.knowledgebaseIds = data.knowledgebaseIds;
  if (data.tools !== undefined) values.tools = data.tools;
  if (data.skillMode !== undefined) values.skillMode = data.skillMode;
  if (data.skillIds !== undefined) values.skillIds = data.skillIds;
  if (data.promptMode !== undefined) values.promptMode = data.promptMode;
  if (data.promptIds !== undefined) values.promptIds = data.promptIds;
  if (data.subagentIds !== undefined) values.subagentIds = data.subagentIds;
  if (data.guardrails !== undefined) values.guardrails = data.guardrails;
  if (data.avatar !== undefined) values.avatar = data.avatar;
  return values;
}

async function verifyOwnedKnowledgebases(
  userId: string,
  kbIds: string[] | undefined,
): Promise<Result<true, CommonError>> {
  if (!kbIds || kbIds.length === 0) {
    return ok(true);
  }
  const uniqueIds = [...new Set(kbIds)];
  const owned = await filterOwnedKbIds(userId, uniqueIds);
  if (owned.length !== uniqueIds.length) {
    return fail({
      code: ERROR_CODE.NOT_FOUND,
      message: "One or more knowledge bases not found",
    });
  }
  return ok(true);
}

/**
 * Creates a new custom Agent owned by `userId`.
 *
 * @param userId - Authenticated owner user ID
 * @param data - Agent configuration validated against `createAgentSchema`
 * @returns Result wrapping the created `AgentRow`
 */
export async function createAgentForUser(
  userId: string,
  data: z.input<typeof createAgentSchema>,
): Promise<Result<AgentRow, CommonError>> {
  const parsed = createAgentSchema.safeParse(data);
  if (!parsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: parsed.error.issues[0].message,
      issues: formatIssues(parsed.error),
    });
  }

  const validated = parsed.data;
  const kbCheck = await verifyOwnedKnowledgebases(
    userId,
    validated.knowledgebaseIds,
  );
  if (!kbCheck.ok) {
    return kbCheck;
  }

  const subagentIds = validated.subagentIds ?? [];
  const insertAgent = async (executor: SubagentLinkTx) => {
    const [inserted] = await executor
      .insert(agent)
      .values({
        userId,
        name: validated.name,
        description: validated.description ?? null,
        prompt: validated.prompt ?? null,
        subagentPrompt: validated.subagentPrompt ?? null,
        modelId: validated.modelId ?? null,
        reasoningEffort: validated.reasoningEffort ?? null,
        knowledgebaseIds: validated.knowledgebaseIds ?? [],
        tools: validated.tools ?? [...DEFAULT_ENABLED_TOOLS],
        skillMode: validated.skillMode,
        skillIds: validated.skillIds,
        promptMode: validated.promptMode,
        promptIds: validated.promptIds,
        subagentIds,
        guardrails: validated.guardrails ?? DEFAULT_AGENT_GUARDRAILS,
        avatar: validated.avatar ?? null,
      })
      .returning();
    return inserted;
  };

  let row: AgentRow;
  if (subagentIds.length > 0) {
    const txResult = await withSubagentLinkLock(userId, async (tx) => {
      const linkCheck = await validateTargetSubagentIds(
        userId,
        subagentIds,
        undefined,
        tx,
      );
      if (!linkCheck.ok) {
        return linkCheck;
      }
      return ok(await insertAgent(tx));
    });
    if (!txResult.ok) {
      return txResult;
    }
    row = txResult.value;
  } else {
    row = await insertAgent(db);
  }

  log.info("Created Agent (id: {id})", {
    id: row.id,
    name: row.name,
    userId,
  });

  return ok(row);
}

/**
 * Updates an existing custom Agent owned by `userId`.
 * Rejects built-in agent IDs and enforces both 2-layer subagent link rules.
 *
 * @param userId - Authenticated owner user ID
 * @param id - Agent UUID
 * @param data - Partial update payload
 * @returns Result wrapping the updated `AgentRow`
 */
export async function updateAgentForUser(
  userId: string,
  id: string,
  data: z.input<typeof updateAgentSchema>,
): Promise<Result<AgentRow, CommonError>> {
  if (isBuiltInAgentId(id)) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Built-in agents cannot be modified",
    });
  }

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Invalid entity ID format",
    });
  }
  const validatedId = idParsed.data;

  const dataParsed = updateAgentSchema.safeParse(data);
  if (!dataParsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: dataParsed.error.issues[0].message,
      issues: formatIssues(dataParsed.error),
    });
  }
  const validatedData = dataParsed.data;

  const kbCheck = await verifyOwnedKnowledgebases(
    userId,
    validatedData.knowledgebaseIds,
  );
  if (!kbCheck.ok) {
    return kbCheck;
  }

  const persistUpdate = async (executor: SubagentLinkTx) => {
    const [updated] = await executor
      .update(agent)
      .set(buildAgentUpdateValues(validatedData))
      .where(whereOwner(agent, validatedId, userId))
      .returning();
    return updated;
  };

  let row: AgentRow | undefined;
  if (validatedData.subagentIds && validatedData.subagentIds.length > 0) {
    const subagentIds = validatedData.subagentIds;
    const txResult = await withSubagentLinkLock(userId, async (tx) => {
      const targetCheck = await validateTargetSubagentIds(
        userId,
        subagentIds,
        validatedId,
        tx,
      );
      if (!targetCheck.ok) {
        return targetCheck;
      }

      const orchestratorCheck = await validateAgentCanBecomeOrchestrator(
        userId,
        validatedId,
        tx,
      );
      if (!orchestratorCheck.ok) {
        return orchestratorCheck;
      }

      return ok(await persistUpdate(tx));
    });
    if (!txResult.ok) {
      return txResult;
    }
    row = txResult.value;
  } else {
    row = await persistUpdate(db);
  }

  if (!row) {
    return fail({
      code: ERROR_CODE.NOT_FOUND,
      message: "Not Found",
    });
  }

  log.info("Updated Agent (id: {id})", {
    id: validatedId,
    userId,
  });

  return ok(row);
}
