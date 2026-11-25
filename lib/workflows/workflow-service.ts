import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
  type WorkflowRow,
  workflow,
  workflowEdge,
  workflowNode,
} from "@/drizzle/schemas/workflow-schema";
import {
  type SubagentLinkTx,
  validateTargetSubagentIds,
  withSubagentLinkLock,
} from "@/lib/agents/validate-subagent-links";
import { ERROR_CODE } from "@/lib/error/error-code";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { assertWorkflowKbsOwned } from "@/lib/workflows/assert-workflow-kbs-owned";
import {
  buildDefaultWorkflowGraph,
  insertWorkflowGraph,
  validateWorkflowGraphInput,
} from "@/lib/workflows/workflow-graph-persistence";
import {
  createWorkflowSchema,
  updateWorkflowSchema,
} from "@/schemas/workflows/workflow";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

function buildWorkflowUpdateValues(
  validated: z.infer<typeof updateWorkflowSchema>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (validated.name !== undefined) values.name = validated.name;
  if (validated.description !== undefined)
    values.description = validated.description;
  if (validated.globalContext !== undefined)
    values.globalContext = validated.globalContext;
  if (validated.modelId !== undefined) values.modelId = validated.modelId;
  if (validated.reasoningEffort !== undefined)
    values.reasoningEffort = validated.reasoningEffort;
  if (validated.tools !== undefined) values.tools = validated.tools;
  if (validated.skillMode !== undefined) values.skillMode = validated.skillMode;
  if (validated.skillIds !== undefined) values.skillIds = validated.skillIds;
  if (validated.knowledgeBaseIds !== undefined)
    values.knowledgeBaseIds = validated.knowledgeBaseIds;
  if (validated.subagentIds !== undefined)
    values.subagentIds = validated.subagentIds;
  if (validated.requiresFileUpload !== undefined)
    values.requiresFileUpload = validated.requiresFileUpload;
  if (validated.canvasConfig !== undefined)
    values.canvasConfig = validated.canvasConfig;
  if (validated.approvalConfig !== undefined)
    values.approvalConfig = validated.approvalConfig;
  return values;
}

/**
 * Creates a new visual DAG workflow with validated nodes, edges, KB ownership,
 * and subagent links for `userId`.
 */
export async function createWorkflowForUser(
  userId: string,
  data: z.input<typeof createWorkflowSchema>,
): Promise<Result<WorkflowRow, CommonError>> {
  const parsed = createWorkflowSchema.safeParse(data);
  if (!parsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Invalid workflow configuration",
      issues: parsed.error.issues.map((i) => i.message),
    });
  }
  const validated = parsed.data;

  const defaults = buildDefaultWorkflowGraph();
  const nodes = validated.nodes ?? defaults.nodes;
  const edges = validated.edges ?? (validated.nodes ? [] : defaults.edges);

  const graphCheck = validateWorkflowGraphInput(nodes, edges);
  if (!graphCheck.ok) {
    return graphCheck;
  }

  if (
    !(await assertWorkflowKbsOwned(userId, validated.knowledgeBaseIds, nodes))
  ) {
    return fail({
      code: ERROR_CODE.FORBIDDEN,
      message: "One or more knowledge bases are not accessible",
    });
  }

  const subagentIds = validated.subagentIds ?? [];
  const webhookSecret = randomBytes(32).toString("hex");

  const runInsert = async (tx: Pick<typeof db, "insert">) => {
    const [inserted] = await tx
      .insert(workflow)
      .values({
        name: validated.name,
        description: validated.description ?? null,
        globalContext: validated.globalContext ?? null,
        modelId: validated.modelId ?? null,
        reasoningEffort: validated.reasoningEffort ?? null,
        tools: validated.tools,
        skillMode: validated.skillMode,
        skillIds: validated.skillIds,
        knowledgeBaseIds: validated.knowledgeBaseIds,
        subagentIds,
        requiresFileUpload: validated.requiresFileUpload,
        canvasConfig: validated.canvasConfig,
        approvalConfig: validated.approvalConfig,
        webhookSecret,
        userId,
      })
      .returning();

    await insertWorkflowGraph(tx, inserted.id, nodes, edges);
    return inserted;
  };

  if (subagentIds.length > 0) {
    return withSubagentLinkLock(userId, async (tx) => {
      const linkCheck = await validateTargetSubagentIds(
        userId,
        subagentIds,
        undefined,
        tx,
      );
      if (!linkCheck.ok) return linkCheck;
      return ok(await runInsert(tx));
    });
  }

  const created = await db.transaction(async (tx) => runInsert(tx));
  return ok(created);
}

/**
 * Updates workflow settings and atomically replaces nodes and edges inside a
 * transaction when `nodes` is provided.
 */
export async function updateWorkflowForUser(
  userId: string,
  id: string,
  data: z.input<typeof updateWorkflowSchema>,
): Promise<Result<WorkflowRow, CommonError>> {
  const parsed = updateWorkflowSchema.safeParse(data);
  if (!parsed.success) {
    return fail({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Invalid workflow update",
      issues: parsed.error.issues.map((i) => i.message),
    });
  }
  const validated = parsed.data;

  if (validated.nodes !== undefined) {
    const graphCheck = validateWorkflowGraphInput(
      validated.nodes,
      validated.edges ?? [],
    );
    if (!graphCheck.ok) {
      return graphCheck;
    }
  }

  if (
    !(await assertWorkflowKbsOwned(
      userId,
      validated.knowledgeBaseIds,
      validated.nodes,
    ))
  ) {
    return fail({
      code: ERROR_CODE.FORBIDDEN,
      message: "One or more knowledge bases are not accessible",
    });
  }

  const values = buildWorkflowUpdateValues(validated);

  const persistUpdate = async (tx: SubagentLinkTx) => {
    const [updated] = await tx
      .update(workflow)
      .set(values)
      .where(and(eq(workflow.id, id), eq(workflow.userId, userId)))
      .returning();

    if (!updated) return undefined;

    if (validated.nodes !== undefined) {
      await tx
        .delete(workflowEdge)
        .where(eq(workflowEdge.workflowId, updated.id));
      await tx
        .delete(workflowNode)
        .where(eq(workflowNode.workflowId, updated.id));

      await insertWorkflowGraph(
        tx,
        updated.id,
        validated.nodes,
        validated.edges ?? [],
      );
    }

    return updated;
  };

  let row: WorkflowRow | undefined;
  if (validated.subagentIds && validated.subagentIds.length > 0) {
    const subagentIds = validated.subagentIds;
    const txResult = await withSubagentLinkLock(userId, async (tx) => {
      const linkCheck = await validateTargetSubagentIds(
        userId,
        subagentIds,
        undefined,
        tx,
      );
      if (!linkCheck.ok) return linkCheck;
      return ok(await persistUpdate(tx));
    });
    if (!txResult.ok) return txResult;
    row = txResult.value;
  } else {
    row = await db.transaction(async (tx) => persistUpdate(tx));
  }

  if (!row) {
    return fail({ code: ERROR_CODE.NOT_FOUND, message: "Not Found" });
  }

  return ok(row);
}
