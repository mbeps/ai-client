import { and, eq, or } from "drizzle-orm";
import { getBuiltInAgentById } from "@/config/built-in-agents";
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
import {
  workflow,
  workflowEdge,
  workflowNode,
} from "@/drizzle/schemas/workflow-schema";
import {
  listWorkspaceResourceItems,
  sanitizeConnectorUrl,
} from "@/lib/app-tools/inspect-workspace-list";
import { readSkillFileForUser } from "@/lib/skills/read-skill-file";

/** All workspace resource types supported by `inspect_workspace`. */
export const INSPECTABLE_RESOURCES = [
  "skills",
  "projects",
  "agents",
  "prompts",
  "workflows",
  "memories",
  "models",
  "knowledgebases",
  "connectors",
] as const;

/** Union of inspectable workspace resource identifiers. */
export type InspectableResource = (typeof INSPECTABLE_RESOURCES)[number];

/**
 * Lists up to `limit` (clamped 1..100, default 50) user-owned workspace items
 * using strict non-secret field projections.
 */
export function listWorkspaceResource(
  userId: string,
  resource: InspectableResource,
  limit?: number,
): Promise<Record<string, unknown>[]> {
  return listWorkspaceResourceItems(userId, resource, limit);
}

/**
 * Retrieves one user-owned workspace item (or built-in agent) with strict
 * non-secret projections. For skills, supports UUID or slug and optional `filePath`.
 */
export async function getWorkspaceResource(
  userId: string,
  resource: InspectableResource,
  identifier: string,
  filePath?: string,
): Promise<Record<string, unknown> | null> {
  switch (resource) {
    case "skills": {
      if (filePath !== undefined) {
        const file = await readSkillFileForUser(userId, identifier, filePath);
        return file ? { ...file } : null;
      }
      const [row] = await db
        .select({
          id: skill.id,
          name: skill.name,
          displayName: skill.displayName,
          description: skill.description,
          content: skill.content,
          files: skill.files,
          enabled: skill.enabled,
          updatedAt: skill.updatedAt,
        })
        .from(skill)
        .where(
          and(
            eq(skill.userId, userId),
            or(eq(skill.id, identifier), eq(skill.name, identifier)),
          ),
        );
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        description: row.description,
        enabled: row.enabled,
        content: row.content,
        files: (row.files ?? []).map((f) => ({
          path: f.path,
          sizeBytes: f.content.length,
        })),
        updatedAt: row.updatedAt,
      };
    }

    case "projects": {
      const [row] = await db
        .select({
          id: project.id,
          name: project.name,
          description: project.description,
          globalPrompt: project.globalPrompt,
          tools: project.tools,
          skillMode: project.skillMode,
          skillIds: project.skillIds,
          promptMode: project.promptMode,
          promptIds: project.promptIds,
          subagentIds: project.subagentIds,
          knowledgebaseId: project.knowledgebaseId,
          updatedAt: project.updatedAt,
        })
        .from(project)
        .where(and(eq(project.id, identifier), eq(project.userId, userId)));
      return row ?? null;
    }

    case "agents": {
      const builtIn = getBuiltInAgentById(identifier);
      if (builtIn) {
        return {
          id: builtIn.id,
          name: builtIn.name,
          description: builtIn.description,
          prompt: builtIn.prompt,
          subagentPrompt: builtIn.subagentPrompt,
          guardrails: builtIn.guardrails,
          isBuiltIn: true,
        };
      }
      const [row] = await db
        .select({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          prompt: agent.prompt,
          subagentPrompt: agent.subagentPrompt,
          modelId: agent.modelId,
          reasoningEffort: agent.reasoningEffort,
          knowledgebaseIds: agent.knowledgebaseIds,
          tools: agent.tools,
          skillMode: agent.skillMode,
          skillIds: agent.skillIds,
          promptMode: agent.promptMode,
          promptIds: agent.promptIds,
          subagentIds: agent.subagentIds,
          guardrails: agent.guardrails,
          updatedAt: agent.updatedAt,
        })
        .from(agent)
        .where(and(eq(agent.id, identifier), eq(agent.userId, userId)));
      return row ? { ...row, isBuiltIn: false } : null;
    }

    case "prompts": {
      const [row] = await db
        .select({
          id: prompt.id,
          title: prompt.title,
          shortcut: prompt.shortcut,
          content: prompt.content,
          projectIds: prompt.projectIds,
          agentIds: prompt.agentIds,
          updatedAt: prompt.updatedAt,
        })
        .from(prompt)
        .where(and(eq(prompt.id, identifier), eq(prompt.userId, userId)));
      return row ?? null;
    }

    case "workflows": {
      const [wfRow] = await db
        .select({
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          globalContext: workflow.globalContext,
          modelId: workflow.modelId,
          reasoningEffort: workflow.reasoningEffort,
          tools: workflow.tools,
          skillMode: workflow.skillMode,
          skillIds: workflow.skillIds,
          knowledgeBaseIds: workflow.knowledgeBaseIds,
          subagentIds: workflow.subagentIds,
          requiresFileUpload: workflow.requiresFileUpload,
          canvasConfig: workflow.canvasConfig,
          approvalConfig: workflow.approvalConfig,
          updatedAt: workflow.updatedAt,
        })
        .from(workflow)
        .where(and(eq(workflow.id, identifier), eq(workflow.userId, userId)));
      if (!wfRow) return null;

      const nodes = await db
        .select({
          id: workflowNode.id,
          type: workflowNode.type,
          name: workflowNode.name,
          position: workflowNode.position,
          data: workflowNode.data,
        })
        .from(workflowNode)
        .where(eq(workflowNode.workflowId, wfRow.id));

      const edges = await db
        .select({
          id: workflowEdge.id,
          sourceNodeId: workflowEdge.sourceNodeId,
          targetNodeId: workflowEdge.targetNodeId,
          sourceHandle: workflowEdge.sourceHandle,
          targetHandle: workflowEdge.targetHandle,
        })
        .from(workflowEdge)
        .where(eq(workflowEdge.workflowId, wfRow.id));

      return { ...wfRow, nodes, edges };
    }

    case "memories": {
      const [row] = await db
        .select({
          id: userMemory.id,
          content: userMemory.content,
          updatedAt: userMemory.updatedAt,
        })
        .from(userMemory)
        .where(
          and(eq(userMemory.id, identifier), eq(userMemory.userId, userId)),
        );
      return row ?? null;
    }

    case "models": {
      const [row] = await db
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
        .where(and(eq(aiModel.id, identifier), eq(aiModel.userId, userId)));
      return row ?? null;
    }

    case "knowledgebases": {
      const [row] = await db
        .select({
          id: knowledgebase.id,
          name: knowledgebase.name,
          description: knowledgebase.description,
          indexStatus: knowledgebase.indexStatus,
          lastIndexedAt: knowledgebase.lastIndexedAt,
          updatedAt: knowledgebase.updatedAt,
        })
        .from(knowledgebase)
        .where(
          and(
            eq(knowledgebase.id, identifier),
            eq(knowledgebase.userId, userId),
          ),
        );
      return row ?? null;
    }

    case "connectors": {
      const [row] = await db
        .select({
          id: mcpServer.id,
          name: mcpServer.name,
          url: mcpServer.url,
          enabled: mcpServer.enabled,
          authType: mcpServer.authType,
          isPublic: mcpServer.isPublic,
        })
        .from(mcpServer)
        .where(and(eq(mcpServer.id, identifier), eq(mcpServer.userId, userId)));
      return row ? { ...row, url: sanitizeConnectorUrl(row.url) } : null;
    }
  }
}
