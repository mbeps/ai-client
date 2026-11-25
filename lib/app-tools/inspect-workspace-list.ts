import { desc, eq } from "drizzle-orm";
import { BUILT_IN_AGENTS } from "@/config/built-in-agents";
import { db } from "@/drizzle/db";
import { agent } from "@/drizzle/schemas/agent-schema";
import { aiModel } from "@/drizzle/schemas/ai-model-schema";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { mcpServer } from "@/drizzle/schemas/mcp-server-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { prompt } from "@/drizzle/schemas/prompt-schema";
import { skill } from "@/drizzle/schemas/skill-schema";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { workflow } from "@/drizzle/schemas/workflow-schema";
import type { InspectableResource } from "@/lib/app-tools/inspect-workspace-queries";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

/**
 * Strips embedded userinfo, query parameters, and fragments from a connector URL
 * before returning it in workspace inspection projections.
 *
 * @param rawUrl - Raw connector URL from database
 * @returns Sanitized origin + pathname string
 */
export function sanitizeConnectorUrl(rawUrl: string): string {
  if (typeof rawUrl !== "string") return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl.split(/[?#]/)[0];
  }
}

function clampLimit(limit?: number): number {
  return Math.min(
    Math.max(Math.trunc(limit ?? DEFAULT_LIST_LIMIT), 1),
    MAX_LIST_LIMIT,
  );
}

/**
 * Lists up to `limit` (clamped 1..100, default 50) user-owned workspace items
 * using strict non-secret field projections.
 */
export async function listWorkspaceResourceItems(
  userId: string,
  resource: InspectableResource,
  limit?: number,
): Promise<Record<string, unknown>[]> {
  const safeLimit = clampLimit(limit);

  switch (resource) {
    case "skills":
      return db
        .select({
          id: skill.id,
          name: skill.name,
          displayName: skill.displayName,
          description: skill.description,
          enabled: skill.enabled,
          updatedAt: skill.updatedAt,
        })
        .from(skill)
        .where(eq(skill.userId, userId))
        .orderBy(desc(skill.updatedAt))
        .limit(safeLimit);

    case "projects":
      return db
        .select({
          id: project.id,
          name: project.name,
          description: project.description,
          knowledgebaseId: project.knowledgebaseId,
          updatedAt: project.updatedAt,
        })
        .from(project)
        .where(eq(project.userId, userId))
        .orderBy(desc(project.updatedAt))
        .limit(safeLimit);

    case "agents": {
      const custom = await db
        .select({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          modelId: agent.modelId,
          updatedAt: agent.updatedAt,
        })
        .from(agent)
        .where(eq(agent.userId, userId))
        .orderBy(desc(agent.updatedAt))
        .limit(safeLimit);

      return [
        ...custom.map((row) => ({ ...row, isBuiltIn: false })),
        ...BUILT_IN_AGENTS.map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          modelId: b.modelId,
          isBuiltIn: true,
        })),
      ].slice(0, safeLimit);
    }

    case "prompts":
      return db
        .select({
          id: prompt.id,
          title: prompt.title,
          shortcut: prompt.shortcut,
          projectIds: prompt.projectIds,
          agentIds: prompt.agentIds,
          updatedAt: prompt.updatedAt,
        })
        .from(prompt)
        .where(eq(prompt.userId, userId))
        .orderBy(desc(prompt.updatedAt))
        .limit(safeLimit);

    case "workflows":
      return db
        .select({
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          requiresFileUpload: workflow.requiresFileUpload,
          updatedAt: workflow.updatedAt,
        })
        .from(workflow)
        .where(eq(workflow.userId, userId))
        .orderBy(desc(workflow.updatedAt))
        .limit(safeLimit);

    case "memories":
      return db
        .select({
          id: userMemory.id,
          content: userMemory.content,
          updatedAt: userMemory.updatedAt,
        })
        .from(userMemory)
        .where(eq(userMemory.userId, userId))
        .orderBy(desc(userMemory.updatedAt))
        .limit(safeLimit);

    case "models":
      return db
        .select({
          id: aiModel.id,
          modelId: aiModel.modelId,
          name: aiModel.label,
          providerName: aiProvider.name,
          capTools: aiModel.capTools,
          capVision: aiModel.capVision,
          capReasoning: aiModel.capReasoning,
          contextWindow: aiModel.contextWindow,
        })
        .from(aiModel)
        .innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
        .where(eq(aiModel.userId, userId))
        .orderBy(desc(aiModel.updatedAt))
        .limit(safeLimit);

    case "knowledgebases":
      return db
        .select({
          id: knowledgebase.id,
          name: knowledgebase.name,
          description: knowledgebase.description,
          indexStatus: knowledgebase.indexStatus,
          updatedAt: knowledgebase.updatedAt,
        })
        .from(knowledgebase)
        .where(eq(knowledgebase.userId, userId))
        .orderBy(desc(knowledgebase.updatedAt))
        .limit(safeLimit);

    case "connectors": {
      const rows = await db
        .select({
          id: mcpServer.id,
          name: mcpServer.name,
          url: mcpServer.url,
          enabled: mcpServer.enabled,
          authType: mcpServer.authType,
          isPublic: mcpServer.isPublic,
        })
        .from(mcpServer)
        .where(eq(mcpServer.userId, userId))
        .orderBy(desc(mcpServer.updatedAt))
        .limit(safeLimit);
      return rows.map((row) => ({
        ...row,
        url: sanitizeConnectorUrl(row.url),
      }));
    }
  }
}
