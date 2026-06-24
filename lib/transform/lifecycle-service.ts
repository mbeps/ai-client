/**
 * Lifecycle service for transform runs. Consolidates the three lifecycle
 * branches (new / start / resume) into a single function parameterised by
 * a type discriminant.
 */

import { db } from "@/drizzle/db";
import { transformAgent, transformRun } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

/** Shape returned by initTransformRun. */
export type InitTransformRunResult = {
  run: typeof transformRun.$inferSelect;
  agent: typeof transformAgent.$inferSelect;
  startFromStep: number;
};

/** Body fields accepted by initTransformRun. */
export type InitTransformRunBody = {
  agentId?: string;
  runId?: string;
  inputAttachmentIds?: string | string[];
  dryRun?: boolean;
};

/**
 * Initialises (or re-initialises) a transform run for the given lifecycle type.
 *
 * - `"new"` — creates a fresh run record from an agent template (status filter: none).
 * - `"start"` — picks up a `pending` run and sets it to `running` (status filter: pending).
 * - `"resume"` — picks up an `awaiting_review` run and sets it to `running` (status filter: awaiting_review).
 *
 * All branches perform ownership validation. Returns the run row, agent row,
 * and the step index from which execution should begin.
 */
export async function initTransformRun(
  type: "new" | "start" | "resume",
  body: InitTransformRunBody,
  userId: string,
): Promise<InitTransformRunResult> {
  if (type === "new") {
    return initNewRun(body, userId);
  }

  return initExistingRun(type, body, userId);
}

/* ── internal helpers ────────────────────────────────────────────────── */

async function initNewRun(
  body: InitTransformRunBody,
  userId: string,
): Promise<InitTransformRunResult> {
  const agentId = body.agentId;
  if (!agentId) {
    throw new Error("agentId is required for new runs");
  }

  // Verify agent ownership
  const agents = await db
    .select()
    .from(transformAgent)
    .where(
      and(eq(transformAgent.id, agentId), eq(transformAgent.userId, userId)),
    )
    .limit(1);

  const agent = agents[0];
  if (!agent) {
    throw new Error("Agent not found");
  }

  // Create a new run record
  const [created] = await db
    .insert(transformRun)
    .values([
      {
        agentId,
        userId,
        status: "running",
        dryRun: body.dryRun ?? false,
        inputAttachmentIds: normaliseAttachmentIds(body.inputAttachmentIds),
        outputAttachmentIds: [],
      },
    ])
    .returning();

  logger.info(
    "[Transform AI] New run initialized",
    {
      runId: created.id,
      agentId,
      dryRun: created.dryRun,
    },
    userId,
  );

  return { run: created, agent, startFromStep: 0 };
}

async function initExistingRun(
  type: "start" | "resume",
  body: InitTransformRunBody,
  userId: string,
): Promise<InitTransformRunResult> {
  const runId = body.runId;
  if (!runId) {
    throw new Error("runId is required for start/resume");
  }

  const expectedStatus = type === "start" ? "pending" : "awaiting_review";
  const statusLabel = type === "start" ? "pending" : "awaiting review";

  // Fetch the run with the required status
  const runs = await db
    .select()
    .from(transformRun)
    .where(
      and(
        eq(transformRun.id, runId),
        eq(transformRun.userId, userId),
        eq(transformRun.status, expectedStatus),
      ),
    )
    .limit(1);

  const run = runs[0];
  if (!run) {
    throw new Error(`Run not found or not in ${statusLabel} status`);
  }

  // Verify agent ownership
  const agents = await db
    .select()
    .from(transformAgent)
    .where(
      and(
        eq(transformAgent.id, run.agentId),
        eq(transformAgent.userId, userId),
      ),
    )
    .limit(1);

  const agent = agents[0];
  if (!agent) {
    throw new Error("Agent not found");
  }

  const startFromStep =
    type === "resume" ? (run.currentStepIndex ?? -1) + 1 : 0;

  logger.info(
    type === "start"
      ? "[Transform AI] Run started"
      : "[Transform AI] Run resumed",
    {
      runId: run.id,
      agentId: run.agentId,
      ...(type === "resume" ? { startFromStep } : {}),
    },
    userId,
  );

  // Update status to running
  await db
    .update(transformRun)
    .set({ status: "running" })
    .where(eq(transformRun.id, run.id));

  return { run, agent, startFromStep };
}

function normaliseAttachmentIds(ids: string | string[] | undefined): string[] {
  if (Array.isArray(ids)) return ids;
  if (typeof ids === "string") return [ids];
  return [];
}
