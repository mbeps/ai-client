import { and, eq } from "drizzle-orm";
import { env } from "@/config/env";
import { db } from "@/drizzle/db";
import { mcpServer } from "@/drizzle/schema";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import { getLogger } from "@/lib/logger";
import { hybridSearch } from "@/lib/rag/hybrid-search";

const log = getLogger(["app", "transform", "context"]);

interface LoadTransformContextArgs {
  userId: string;
  agentRow: {
    id: string;
    name: string;
    description?: string | null;
    modelId?: string | null;
    knowledgeBaseIds?: string[];
    globalContext?: string | null;
    tools?: string[];
    steps: string;
  };
  modelOverride?: string | null;
  anyArtifactToolSelected?: boolean;
}

/**
 * Loads all context required for a transform run: resolved AI provider,
 * active MCP tools, and Knowledge Base context.
 *
 * @author Maruf Bepary
 */
export async function loadTransformContext({
  userId,
  agentRow,
  modelOverride,
  anyArtifactToolSelected = false,
}: LoadTransformContextArgs) {
  /* 1. Parallel loading of servers and KB results */
  const serversPromise = db
    .select()
    .from(mcpServer)
    .where(and(eq(mcpServer.userId, userId), eq(mcpServer.enabled, true)));

  // Resolve model ID
  const model = modelOverride ?? agentRow.modelId ?? null;
  const providerPromise = model
    ? resolveProvider(userId, model)
    : resolveDefaultChatProvider(userId);

  // KB Search if applicable
  let kbContextPromise: Promise<string> = Promise.resolve("");
  const kbIds = agentRow.knowledgeBaseIds;
  if (kbIds && kbIds.length > 0) {
    kbContextPromise = (async () => {
      try {
        const results = await Promise.all(
          kbIds.map((id) =>
            hybridSearch(
              id,
              agentRow.globalContext || agentRow.description || agentRow.name,
              userId,
              env.TRANSFORM_TOP_K,
            ),
          ),
        );
        const allChunks = results.flat();
        if (allChunks.length > 0) {
          return (
            "\n\nKnowledge Base Context:\n" +
            allChunks.map((c) => c.content).join("\n---\n")
          );
        }
      } catch (err) {
        log.warn("KB retrieval failed for transform agent {agentId}: {error}", {
          agentId: agentRow.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return "";
    })();
  }

  const [allServers, resolvedProvider, kbContext] = await Promise.all([
    serversPromise,
    providerPromise,
    kbContextPromise,
  ]);

  /* 2. Determine tool requirements */
  let steps: any[] = [];
  try {
    steps = JSON.parse(agentRow.steps);
  } catch {
    steps = [];
  }

  const effectiveArtifactToolSelected =
    anyArtifactToolSelected ||
    (agentRow.tools || []).includes("internal:tool:manage_artifact") ||
    steps.some((s) =>
      (s.toolIds || []).includes("internal:tool:manage_artifact"),
    );

  /* 3. Register MCP tools */
  const { mcpTools, toolSourceMap, mcpCleanup } = await registerMcpTools(
    allServers as any,
    undefined,
    effectiveArtifactToolSelected,
    null,
    false,
    userId,
  );

  return {
    allServers,
    resolvedProvider,
    kbContext,
    mcpTools,
    toolSourceMap,
    mcpCleanup,
  };
}
