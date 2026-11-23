"use server";

import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { workflow, workflowNode } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { WorkflowItem } from "@/types/workflows/workflow";

/**
 * Lists all workflows owned by the authenticated user enriched with node counts and trigger flags.
 */
export const listWorkflows = defineAction(
  async (): Promise<Result<WorkflowItem[], CommonError>> => {
    const session = await requireSession();

    const rows = await db
      .select()
      .from(workflow)
      .where(eq(workflow.userId, session.user.id))
      .orderBy(desc(workflow.updatedAt));

    if (rows.length === 0) {
      return ok([]);
    }

    const workflowIds = rows.map((r) => r.id);
    const nodeMeta = await db
      .select({ workflowId: workflowNode.workflowId, type: workflowNode.type })
      .from(workflowNode)
      .where(inArray(workflowNode.workflowId, workflowIds));

    const metaMap = new Map<
      string,
      { count: number; hasManual: boolean; hasWebhook: boolean }
    >();
    for (const node of nodeMeta) {
      const entry = metaMap.get(node.workflowId) ?? {
        count: 0,
        hasManual: false,
        hasWebhook: false,
      };
      entry.count += 1;
      if (node.type === "manual_trigger") entry.hasManual = true;
      if (node.type === "webhook_trigger") entry.hasWebhook = true;
      metaMap.set(node.workflowId, entry);
    }

    return ok(
      rows.map((row) => {
        const meta = metaMap.get(row.id);
        return {
          id: row.id,
          userId: row.userId,
          name: row.name,
          description: row.description ?? "",
          globalContext: row.globalContext ?? undefined,
          modelId: row.modelId ?? undefined,
          tools: row.tools ?? [],
          skillMode: row.skillMode,
          skillIds: row.skillIds ?? [],
          knowledgeBaseIds: row.knowledgeBaseIds ?? [],
          subagentIds: row.subagentIds ?? [],
          requiresFileUpload: row.requiresFileUpload,
          canvasConfig: row.canvasConfig,
          approvalConfig: row.approvalConfig,
          webhookSecret: row.webhookSecret,
          nodeCount: meta?.count ?? 0,
          hasManualTrigger: meta?.hasManual ?? false,
          hasWebhookTrigger: meta?.hasWebhook ?? false,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        };
      }),
    );
  },
);
