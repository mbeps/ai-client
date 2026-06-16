"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/actions/require-session";
import { logger } from "@/lib/logger";
import { isBlockedUrl } from "@/lib/mcp/url-guard";
import { decodeProviderRecord } from "@/lib/actions/providers/utils";

export type SyncProviderModelsResult = {
  added: number;
  unchanged: number;
};

type ProviderModelsResponse = {
  data?: Array<{
    id?: string;
  }>;
};

export async function syncProviderModels(
  providerId: string,
): Promise<SyncProviderModelsResult> {
  const session = await requireSession();

  logger.info(
    "Starting provider model sync",
    { providerId, userId: session.user.id },
    session.user.id,
  );

  const [provider] = await db
    .select()
    .from(aiProvider)
    .where(
      and(
        eq(aiProvider.id, providerId),
        eq(aiProvider.userId, session.user.id),
      ),
    );

  if (!provider) {
    throw new Error("Provider not found");
  }

  if (isBlockedUrl(provider.baseUrl)) {
    throw new Error("Provider URL is blocked by SSRF guard");
  }

  const decoded = decodeProviderRecord(provider);
  const baseUrl = provider.baseUrl.replace(/\/$/, "");

  const commonHeaders = {
    ...(decoded.apiKey ? { Authorization: `Bearer ${decoded.apiKey}` } : {}),
    ...decoded.headers,
  };

  /**
   * Helper to fetch models from a specific endpoint.
   * Returns empty array on failure instead of throwing.
   */
  async function fetchModels(url: string) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: commonHeaders,
      });

      if (!response.ok) {
        logger.warn(
          "[Sync Models] Endpoint returned error status",
          { url, status: response.status },
          session.user.id,
        );
        return [];
      }

      const payload = (await response.json()) as ProviderModelsResponse;
      return payload.data ?? [];
    } catch (err) {
      logger.error(
        "[Sync Models] Failed to fetch",
        err,
        { url },
        session.user.id,
      );
      return [];
    }
  }

  // Probe both endpoints
  const [standardList, embeddingList] = await Promise.all([
    fetchModels(`${baseUrl}/models`),
    fetchModels(`${baseUrl}/embeddings/models`),
  ]);

  // Aggregate models and determine types
  type DiscoveredModel = {
    id: string;
    types: Set<"chat" | "embedding">;
  };
  const modelsMap = new Map<string, DiscoveredModel>();

  // Helper to determine type from ID heuristic
  const isIdxEmbedding = (modelId: string) => {
    const lower = modelId.toLowerCase();
    return (
      lower.includes("embed") ||
      lower.includes("bge-") ||
      lower.includes("text-embedding")
    );
  };

  // Process standard list
  for (const m of standardList) {
    if (!m.id) continue;
    const modelId = m.id.trim();
    if (!modelsMap.has(modelId)) {
      modelsMap.set(modelId, { id: modelId, types: new Set() });
    }
    modelsMap
      .get(modelId)!
      .types.add(isIdxEmbedding(modelId) ? "embedding" : "chat");
  }

  // Process specialized embedding list
  for (const m of embeddingList) {
    if (!m.id) continue;
    const modelId = m.id.trim();
    if (!modelsMap.has(modelId)) {
      modelsMap.set(modelId, { id: modelId, types: new Set() });
    }
    modelsMap.get(modelId)!.types.add("embedding");
  }

  let added = 0;
  let unchanged = 0;

  // Process discovered models (limit to 1000 to prevent OOM)
  const allModels = Array.from(modelsMap.values()).slice(0, 1000);

  for (const discovered of allModels) {
    const modelId = discovered.id;

    // Resolve final model type
    let modelType: "chat" | "embedding" | "both" = "chat";
    const hasChat = discovered.types.has("chat");
    const hasEmbed = discovered.types.has("embedding");

    if (hasChat && hasEmbed) {
      modelType = "both";
    } else if (hasEmbed) {
      modelType = "embedding";
    }

    const [existing] = await db
      .select({ id: aiModel.id, isManuallyAdded: aiModel.isManuallyAdded })
      .from(aiModel)
      .where(
        and(eq(aiModel.providerId, provider.id), eq(aiModel.modelId, modelId)),
      );

    if (existing?.isManuallyAdded) {
      unchanged += 1;
      continue;
    }

    if (existing) {
      await db
        .update(aiModel)
        .set({
          label: modelId,
          modelType,
          isEnabled: true,
          updatedAt: new Date(),
        })
        .where(eq(aiModel.id, existing.id));
      unchanged += 1;
      continue;
    }

    await db.insert(aiModel).values({
      providerId: provider.id,
      userId: session.user.id,
      modelId,
      label: modelId,
      modelType,
      contextWindow: 4096,
      capTools: false,
      capVision: false,
      capReasoning: false,
      capStructuredOutput: false,
      isManuallyAdded: false,
      isEnabled: true,
    });

    added += 1;
  }

  logger.info(
    "Provider model sync complete",
    { providerId, added, unchanged, userId: session.user.id },
    session.user.id,
  );

  return { added, unchanged };
}
