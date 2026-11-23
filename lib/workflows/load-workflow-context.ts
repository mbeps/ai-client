import { and, eq } from "drizzle-orm";
import { env } from "@/config/env";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { db } from "@/drizzle/db";
import {
  mcpServer,
  userMcpServerInstall,
} from "@/drizzle/schemas/mcp-server-schema";
import { skill } from "@/drizzle/schemas/skill-schema";
import { resolveLinkedSubagents } from "@/lib/agents/resolve-linked-subagents";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import { filterOwnedKbIds } from "@/lib/knowledgebases/filter-owned-kb-ids";
import { getLogger } from "@/lib/logger";
import { mcpServerRowToConfig } from "@/lib/mcp/mcp-server-row-to-config";
import { exploreKbGraph } from "@/lib/rag/explore-kb-graph";
import { hybridSearch } from "@/lib/rag/hybrid-search";
import { resolveContextSkills } from "@/lib/skills/resolve-context-skills";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";
import type { SkillRow } from "@/types/skill/skill-row";
import type {
  WorkflowCanvasConfig,
  WorkflowNode,
} from "@/types/workflows/workflow";

const log = getLogger(["app", "workflows", "context"]);

interface LoadWorkflowContextArgs {
  userId: string;
  workflowRow: {
    id: string;
    name: string;
    description?: string | null;
    modelId?: string | null;
    knowledgeBaseIds?: string[];
    globalContext?: string | null;
    tools?: string[];
    skillMode?: SkillMode;
    skillIds?: string[];
    subagentIds?: string[];
    canvasConfig?: WorkflowCanvasConfig;
  };
  nodes: WorkflowNode[];
  modelOverride?: string | null;
}

/**
 * Loads shared execution context for a workflow run: MCP servers, model provider,
 * knowledge base context, skills, and linked subagents.
 */
export async function loadWorkflowContext({
  userId,
  workflowRow,
  nodes,
  modelOverride,
}: LoadWorkflowContextArgs) {
  const serversPromise = Promise.all([
    db
      .select({
        id: mcpServer.id,
        name: mcpServer.name,
        url: mcpServer.url,
        headers: mcpServer.headers,
        authType: mcpServer.authType,
        oauthClientId: mcpServer.oauthClientId,
        oauthClientSecret: mcpServer.oauthClientSecret,
        oauthScope: mcpServer.oauthScope,
      })
      .from(mcpServer)
      .where(and(eq(mcpServer.userId, userId), eq(mcpServer.enabled, true))),
    db
      .select({
        id: mcpServer.id,
        name: mcpServer.name,
        url: mcpServer.url,
        headers: userMcpServerInstall.headers,
        authType: mcpServer.authType,
        oauthClientId: userMcpServerInstall.oauthClientId,
        oauthClientSecret: userMcpServerInstall.oauthClientSecret,
        oauthScope: mcpServer.oauthScope,
      })
      .from(userMcpServerInstall)
      .innerJoin(mcpServer, eq(userMcpServerInstall.serverId, mcpServer.id))
      .where(
        and(
          eq(userMcpServerInstall.userId, userId),
          eq(userMcpServerInstall.enabled, true),
          eq(mcpServer.isPublic, true),
          eq(mcpServer.enabled, true),
        ),
      ),
  ]).then(([personal, installed]) =>
    [...personal, ...installed].map((r) =>
      mcpServerRowToConfig(r as McpServerRow, userId),
    ),
  );

  const model = modelOverride ?? workflowRow.modelId ?? null;
  const providerPromise = model
    ? resolveProvider(userId, model)
    : resolveDefaultChatProvider(userId);

  const skillMode: SkillMode = workflowRow.skillMode ?? "dynamic";
  const skillsPromise: Promise<SkillRow[]> =
    skillMode === "none"
      ? Promise.resolve([])
      : (db
          .select()
          .from(skill)
          .where(
            and(eq(skill.userId, userId), eq(skill.enabled, true)),
          ) as Promise<SkillRow[]>);

  let kbContextPromise: Promise<string> = Promise.resolve("");
  const kbIds = workflowRow.knowledgeBaseIds;
  if (kbIds && kbIds.length > 0) {
    kbContextPromise = (async () => {
      try {
        if (env.RAG_MODE === "file_read") {
          const ownedKbIds = await filterOwnedKbIds(userId, kbIds);
          if (ownedKbIds.length === 0) return "";
          const graph = await exploreKbGraph({ kbIds: ownedKbIds });
          if (graph.documents.length > 0) {
            const lines = graph.documents.map(
              (d) => `- "${d.name}" (${d.documentType}): ${d.summary}`,
            );
            return `\n\nKnowledge Base Document Catalog:\n${lines.join("\n")}`;
          }
          return "";
        }

        const query =
          workflowRow.globalContext ||
          workflowRow.description ||
          workflowRow.name;
        const allChunks = await hybridSearch(
          kbIds,
          query,
          userId,
          env.TRANSFORM_TOP_K,
        );
        if (allChunks.length > 0) {
          return (
            "\n\nKnowledge Base Context:\n" +
            allChunks.map((c) => c.content).join("\n---\n")
          );
        }
      } catch (err) {
        log.warn("KB retrieval failed for workflow {workflowId}: {error}", {
          workflowId: workflowRow.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return "";
    })();
  }

  const [allServers, resolvedProvider, kbContext, userSkills] =
    await Promise.all([
      serversPromise,
      providerPromise,
      kbContextPromise,
      skillsPromise,
    ]);

  const { availableSkills, selectedSkills } = resolveContextSkills({
    skillMode,
    skillIds: workflowRow.skillIds ?? [],
    userSkills,
  });

  const canvasEnabled = workflowRow.canvasConfig?.enabled ?? true;
  const anyNodeRequestsArtifact = nodes.some(
    (n) =>
      n.data.kind === "ai_step" &&
      (n.data.toolIds.includes(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT) ||
        (n.data.canvasMode !== undefined &&
          n.data.canvasMode !== "disabled" &&
          n.data.canvasMode !== "inherit")),
  );
  const effectiveArtifactToolSelected =
    canvasEnabled ||
    (workflowRow.tools || []).includes(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT) ||
    anyNodeRequestsArtifact;

  const hasKbIds = Boolean(kbIds && kbIds.length > 0);
  const kbSubagentConfig =
    typeof resolvedProvider?.sdkProvider?.chat === "function" &&
    resolvedProvider?.modelId
      ? {
          model: resolvedProvider.sdkProvider.chat(resolvedProvider.modelId),
          contextWindow: resolvedProvider.modelRow?.contextWindow ?? undefined,
        }
      : undefined;

  const { mcpTools, toolSourceMap, mcpCleanup } = await registerMcpTools(
    allServers as any,
    undefined,
    effectiveArtifactToolSelected,
    hasKbIds ? kbIds![0] : null,
    hasKbIds,
    userId,
    hasKbIds ? kbIds : undefined,
    ...(kbSubagentConfig ? [kbSubagentConfig] : []),
  );

  const linkedSubagents =
    workflowRow.subagentIds && workflowRow.subagentIds.length > 0
      ? await resolveLinkedSubagents(userId, workflowRow.subagentIds)
      : [];

  return {
    allServers,
    resolvedProvider,
    kbContext,
    availableSkills,
    selectedSkills,
    linkedSubagents,
    mcpTools,
    toolSourceMap,
    mcpCleanup,
  };
}
