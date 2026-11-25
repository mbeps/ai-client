import { z } from "zod";
import { db } from "@/drizzle/db";
import { agent } from "@/drizzle/schemas/agent-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { prompt } from "@/drizzle/schemas/prompt-schema";
import { whereOwner } from "@/lib/db/where-owner";
import { ERROR_CODE } from "@/lib/error/error-code";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import {
  createPromptSchema,
  updatePromptSchema,
} from "@/schemas/prompt/prompt";
import type { CommonError } from "@/types/error/common-error";
import type { PromptRow } from "@/types/prompt/prompt-row";
import type { Result } from "@/types/result";

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) =>
    i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message,
  );
}

async function verifyOwnedScopeIds(
  userId: string,
  projectIds: string[] | undefined,
  agentIds: string[] | undefined,
): Promise<Result<true, CommonError>> {
  if (projectIds && projectIds.length > 0) {
    const uniqueProjectIds = [...new Set(projectIds)];
    const owned = await db
      .select({ id: project.id })
      .from(project)
      .where(whereOwner(project, uniqueProjectIds, userId));
    if (owned.length !== uniqueProjectIds.length) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "One or more projects not found",
      });
    }
  }

  if (agentIds && agentIds.length > 0) {
    const uniqueAgentIds = [...new Set(agentIds)];
    const owned = await db
      .select({ id: agent.id })
      .from(agent)
      .where(whereOwner(agent, uniqueAgentIds, userId));
    if (owned.length !== uniqueAgentIds.length) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "One or more agents not found",
      });
    }
  }

  return ok(true);
}

/**
 * Creates a reusable prompt shortcut owned by `userId`.
 *
 * @param userId - Authenticated owner user ID
 * @param data - Prompt input validated against `createPromptSchema`
 * @returns Result wrapping the created `PromptRow`
 */
export async function createPromptForUser(
  userId: string,
  data: z.input<typeof createPromptSchema>,
): Promise<Result<PromptRow, CommonError>> {
  const parsed = createPromptSchema.safeParse(data);
  if (!parsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: parsed.error.issues[0].message,
      issues: formatIssues(parsed.error),
    });
  }

  const validated = parsed.data;
  const agentIds = validated.agentIds ?? validated.assistantIds;
  const scopeCheck = await verifyOwnedScopeIds(
    userId,
    validated.projectIds,
    agentIds,
  );
  if (!scopeCheck.ok) {
    return scopeCheck;
  }

  const [row] = await db
    .insert(prompt)
    .values({
      title: validated.title,
      shortcut: validated.shortcut,
      content: validated.content,
      projectIds: validated.projectIds,
      agentIds,
      userId,
    })
    .returning();

  return ok(row);
}

/**
 * Updates an existing prompt shortcut owned by `userId`.
 *
 * @param userId - Authenticated owner user ID
 * @param id - Prompt UUID
 * @param data - Partial update payload
 * @returns Result wrapping the updated `PromptRow`
 */
export async function updatePromptForUser(
  userId: string,
  id: string,
  data: z.input<typeof updatePromptSchema>,
): Promise<Result<PromptRow, CommonError>> {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Invalid entity ID format",
    });
  }
  const validatedId = idParsed.data;

  const dataParsed = updatePromptSchema.safeParse(data);
  if (!dataParsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: dataParsed.error.issues[0].message,
      issues: formatIssues(dataParsed.error),
    });
  }
  const validatedData = dataParsed.data;

  const agentIds = validatedData.agentIds ?? validatedData.assistantIds;
  const scopeCheck = await verifyOwnedScopeIds(
    userId,
    validatedData.projectIds,
    agentIds,
  );
  if (!scopeCheck.ok) {
    return scopeCheck;
  }

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (validatedData.title !== undefined)
    updateValues.title = validatedData.title;
  if (validatedData.shortcut !== undefined)
    updateValues.shortcut = validatedData.shortcut;
  if (validatedData.content !== undefined)
    updateValues.content = validatedData.content;
  if (validatedData.projectIds !== undefined)
    updateValues.projectIds = validatedData.projectIds;
  if (agentIds !== undefined) updateValues.agentIds = agentIds;

  const [row] = await db
    .update(prompt)
    .set(updateValues)
    .where(whereOwner(prompt, validatedId, userId))
    .returning();

  if (!row) {
    return fail({
      code: ERROR_CODE.NOT_FOUND,
      message: "Not Found",
    });
  }

  return ok(row);
}
