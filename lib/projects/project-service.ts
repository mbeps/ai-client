import { z } from "zod";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schemas/project-schema";
import {
  type SubagentLinkTx,
  validateTargetSubagentIds,
  withSubagentLinkLock,
} from "@/lib/agents/validate-subagent-links";
import { whereOwner } from "@/lib/db/where-owner";
import { ERROR_CODE } from "@/lib/error/error-code";
import { filterOwnedKbIds } from "@/lib/knowledgebases/filter-owned-kb-ids";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import {
  createProjectSchema,
  updateProjectSchema,
} from "@/schemas/project/project";
import type { CommonError } from "@/types/error/common-error";
import type { ProjectRow } from "@/types/project/project-row";
import type { Result } from "@/types/result";

const log = getLogger(["app", "services", "project"]);

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) =>
    i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message,
  );
}

function normalizeKnowledgebaseId(
  value: string | null | undefined,
): string | null | undefined {
  return value === "" ? null : value;
}

function buildProjectUpdateValues(
  data: z.infer<typeof updateProjectSchema>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) values.name = data.name;
  if (data.description !== undefined) values.description = data.description;
  if (data.globalPrompt !== undefined) values.globalPrompt = data.globalPrompt;
  if (data.tools !== undefined) values.tools = data.tools;
  if (data.skillMode !== undefined) values.skillMode = data.skillMode;
  if (data.skillIds !== undefined) values.skillIds = data.skillIds;
  if (data.promptMode !== undefined) values.promptMode = data.promptMode;
  if (data.promptIds !== undefined) values.promptIds = data.promptIds;
  if (data.subagentIds !== undefined) values.subagentIds = data.subagentIds;
  if (data.knowledgebaseId !== undefined)
    values.knowledgebaseId =
      normalizeKnowledgebaseId(data.knowledgebaseId) ?? null;
  return values;
}

async function verifyOwnedKnowledgebase(
  userId: string,
  knowledgebaseId: string | null | undefined,
): Promise<Result<true, CommonError>> {
  if (!knowledgebaseId) {
    return ok(true);
  }
  const owned = await filterOwnedKbIds(userId, [knowledgebaseId]);
  if (owned.length === 0) {
    return fail({
      code: ERROR_CODE.NOT_FOUND,
      message: "Knowledge base not found",
    });
  }
  return ok(true);
}

/**
 * Creates a new project owned by `userId`, validating schema, KB ownership,
 * and subagent link invariants.
 *
 * @param userId - Authenticated owner user ID
 * @param data - Project configuration input
 * @returns Result wrapping the created `ProjectRow`
 */
export async function createProjectForUser(
  userId: string,
  data: z.input<typeof createProjectSchema>,
): Promise<Result<ProjectRow, CommonError>> {
  const parsed = createProjectSchema.safeParse(data);
  if (!parsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: parsed.error.issues[0].message,
      issues: formatIssues(parsed.error),
    });
  }

  const validated = parsed.data;
  const normalizedKbId = normalizeKnowledgebaseId(validated.knowledgebaseId);
  const kbCheck = await verifyOwnedKnowledgebase(userId, normalizedKbId);
  if (!kbCheck.ok) {
    return kbCheck;
  }

  const subagentIds = validated.subagentIds ?? [];
  const insertProject = async (executor: SubagentLinkTx) => {
    const [inserted] = await executor
      .insert(project)
      .values({
        name: validated.name,
        description: validated.description ?? null,
        globalPrompt: validated.globalPrompt ?? null,
        tools: validated.tools ?? [...DEFAULT_ENABLED_TOOLS],
        skillMode: validated.skillMode,
        skillIds: validated.skillIds,
        promptMode: validated.promptMode,
        promptIds: validated.promptIds,
        subagentIds,
        knowledgebaseId: normalizedKbId ?? null,
        userId,
      })
      .returning();
    return inserted;
  };

  let row: ProjectRow;
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
      return ok(await insertProject(tx));
    });
    if (!txResult.ok) {
      return txResult;
    }
    row = txResult.value;
  } else {
    row = await insertProject(db);
  }

  log.info("Created Project (id: {id})", {
    id: row.id,
    projectId: row.id,
    name: row.name,
    userId,
  });

  return ok(row);
}

/**
 * Updates an existing project owned by `userId` with partial fields.
 *
 * @param userId - Authenticated owner user ID
 * @param id - Project UUID
 * @param data - Partial update payload
 * @returns Result wrapping the updated `ProjectRow`
 */
export async function updateProjectForUser(
  userId: string,
  id: string,
  data: z.input<typeof updateProjectSchema>,
): Promise<Result<ProjectRow, CommonError>> {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Invalid entity ID format",
    });
  }
  const validatedId = idParsed.data;

  const dataParsed = updateProjectSchema.safeParse(data);
  if (!dataParsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: dataParsed.error.issues[0].message,
      issues: formatIssues(dataParsed.error),
    });
  }
  const validatedData = dataParsed.data;

  const kbCheck = await verifyOwnedKnowledgebase(
    userId,
    normalizeKnowledgebaseId(validatedData.knowledgebaseId),
  );
  if (!kbCheck.ok) {
    return kbCheck;
  }

  const persistUpdate = async (executor: SubagentLinkTx) => {
    const [updated] = await executor
      .update(project)
      .set(buildProjectUpdateValues(validatedData))
      .where(whereOwner(project, validatedId, userId))
      .returning();
    return updated;
  };

  let row: ProjectRow | undefined;
  if (validatedData.subagentIds && validatedData.subagentIds.length > 0) {
    const subagentIds = validatedData.subagentIds;
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

  log.info("Updated entity (id: {id})", {
    id: validatedId,
    userId,
  });

  return ok(row);
}
