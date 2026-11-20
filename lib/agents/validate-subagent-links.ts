import { and, eq, inArray, sql } from "drizzle-orm";
import {
  isBuiltInAgentId,
  isLinkableBuiltInAgentId,
} from "@/config/built-in-agents";
import { db } from "@/drizzle/db";
import { agent } from "@/drizzle/schemas/agent-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { transformAgent } from "@/drizzle/schemas/transform-agent-schema";
import { ERROR_CODE } from "@/lib/error/error-code";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/** Transaction-capable Drizzle executor for subagent link operations. */
export type SubagentLinkTx = Pick<
  typeof db,
  "select" | "insert" | "update" | "delete" | "execute"
>;

/**
 * Acquires a per-user PostgreSQL transaction-scoped advisory lock to serialize
 * subagent link mutations and deletions for the same user without deadlocks.
 *
 * @param tx - Active Drizzle transaction executor.
 * @param userId - Authenticated owner ID.
 */
export async function acquireSubagentLinkLock(
  tx: SubagentLinkTx,
  userId: string,
): Promise<void> {
  const lockKey = `subagent_links:${userId}`;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
}

/**
 * Runs a subagent link validation and mutation callback inside a single database
 * transaction protected by the user's advisory lock.
 *
 * @param userId - Authenticated owner ID.
 * @param fn - Transactional callback receiving the locked executor.
 * @returns Callback result.
 */
export async function withSubagentLinkLock<T>(
  userId: string,
  fn: (tx: SubagentLinkTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await acquireSubagentLinkLock(tx, userId);
    return fn(tx);
  });
}

/**
 * Validates Rule 1 of the 2-layer graph invariant:
 * every target subagent ID must be either a linkable built-in agent or a user-owned
 * Leaf Agent (`subagentIds.length === 0`), and never `selfAgentId`.
 *
 * @param userId - Authenticated owner ID.
 * @param targetSubagentIds - Candidate child subagent IDs to link.
 * @param selfAgentId - Optional ID of the parent agent being created/updated.
 * @param tx - Optional transaction executor (defaults to `db`).
 * @returns `ok(undefined)` when valid, or an `INVALID_INPUT` failure.
 */
export async function validateTargetSubagentIds(
  userId: string,
  targetSubagentIds: string[],
  selfAgentId?: string,
  tx: SubagentLinkTx = db,
): Promise<Result<void, CommonError>> {
  if (targetSubagentIds.length === 0) {
    return ok(undefined);
  }

  if (selfAgentId && targetSubagentIds.includes(selfAgentId)) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "An agent cannot link to itself as a subagent",
    });
  }

  const customIds: string[] = [];
  for (const id of targetSubagentIds) {
    if (isBuiltInAgentId(id)) {
      if (!isLinkableBuiltInAgentId(id)) {
        return fail({
          code: ERROR_CODE.INVALID_INPUT,
          message: `Built-in agent "${id}" cannot be linked as a subagent`,
        });
      }
      continue;
    }
    customIds.push(id);
  }

  const uniqueCustomIds = Array.from(new Set(customIds));
  if (uniqueCustomIds.length === 0) {
    return ok(undefined);
  }

  const targets = await tx
    .select({
      id: agent.id,
      name: agent.name,
      subagentIds: agent.subagentIds,
    })
    .from(agent)
    .where(and(eq(agent.userId, userId), inArray(agent.id, uniqueCustomIds)))
    .for("update");

  if (targets.length !== uniqueCustomIds.length) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "One or more selected subagents do not exist",
    });
  }

  const orchestrator = targets.find((t) => t.subagentIds.length > 0);
  if (orchestrator) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: `Agent "${orchestrator.name}" is an Orchestrator Agent (it delegates to subagents) and cannot be linked as a subagent.`,
    });
  }

  return ok(undefined);
}

/**
 * Validates Rule 2 of the 2-layer graph invariant:
 * an agent cannot become an Orchestrator (attach child subagents) while it is
 * linked as a subagent in any other Agent, Project, or Transform Workflow.
 *
 * @param userId - Authenticated owner ID.
 * @param agentId - Candidate agent ID being assigned child subagents.
 * @param tx - Optional transaction executor (defaults to `db`).
 * @returns `ok(undefined)` when unlinked, or an `INVALID_INPUT` failure.
 */
export async function validateAgentCanBecomeOrchestrator(
  userId: string,
  agentId: string,
  tx: SubagentLinkTx = db,
): Promise<Result<void, CommonError>> {
  const [agentRefs, projectRefs, transformRefs] = await Promise.all([
    tx
      .select({ id: agent.id })
      .from(agent)
      .where(
        and(
          eq(agent.userId, userId),
          sql`${agentId} = ANY(${agent.subagentIds})`,
        ),
      )
      .limit(1),
    tx
      .select({ id: project.id })
      .from(project)
      .where(
        and(
          eq(project.userId, userId),
          sql`${agentId} = ANY(${project.subagentIds})`,
        ),
      )
      .limit(1),
    tx
      .select({ id: transformAgent.id })
      .from(transformAgent)
      .where(
        and(
          eq(transformAgent.userId, userId),
          sql`${agentId} = ANY(${transformAgent.subagentIds})`,
        ),
      )
      .limit(1),
  ]);

  if (
    agentRefs.length > 0 ||
    projectRefs.length > 0 ||
    transformRefs.length > 0
  ) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message:
        "This agent is currently linked as a subagent in another Agent, Project, or Workflow. Unlink it before assigning subagents to it.",
    });
  }

  return ok(undefined);
}
