"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";
import { isBlockedUrl } from "@/lib/mcp/url-guard";
import { decodeProviderRecord } from "@/lib/actions/providers/utils";
import { ModelMalformedIdError } from "@/lib/constants/errors";

export type SyncProviderModelsResult = {
  added: number;
  unchanged: number;
  limitExceeded?: boolean;
  totalDiscovered?: number;
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
    throw new Error("Not Found");
  }

  if (await isBlockedUrl(provider.baseUrl)) {
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
  const invalidModels: Array<{ endpoint: string; source: string }> = [];

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
    if (!m.id) {
      invalidModels.push({ endpoint: "/models", source: "standard" });
      continue;
    }
    const modelId = m.id.trim();
    if (!modelId) {
      invalidModels.push({ endpoint: "/models", source: "standard (empty)" });
      continue;
    }
    if (!modelsMap.has(modelId)) {
      modelsMap.set(modelId, { id: modelId, types: new Set() });
    }
    modelsMap
      .get(modelId)!
      .types.add(isIdxEmbedding(modelId) ? "embedding" : "chat");
  }

  // Process specialized embedding list
  for (const m of embeddingList) {
    if (!m.id) {
      invalidModels.push({
        endpoint: "/embeddings/models",
        source: "embedding",
      });
      continue;
    }
    const modelId = m.id.trim();
    if (!modelId) {
      invalidModels.push({
        endpoint: "/embeddings/models",
        source: "embedding (empty)",
      });
      continue;
    }
    if (!modelsMap.has(modelId)) {
      modelsMap.set(modelId, { id: modelId, types: new Set() });
    }
    modelsMap.get(modelId)!.types.add("embedding");
  }

  // If any models have malformed IDs, throw error after collecting all data
  if (invalidModels.length > 0) {
    logger.warn(
      "[Sync Models] Found models with malformed/missing IDs",
      {
        count: invalidModels.length,
        providerId,
        samples: invalidModels.slice(0, 5),
      },
      session.user.id,
    );

    throw new ModelMalformedIdError(invalidModels.length);
  }

  let added = 0;
  let unchanged = 0;

  // Check if model count exceeds 1000-model limit
  const totalDiscovered = modelsMap.size;
  const limitExceeded = totalDiscovered > 1000;

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
    {
      providerId,
      added,
      unchanged,
      totalDiscovered,
      limitExceeded,
      userId: session.user.id,
    },
    session.user.id,
  );

  return { added, unchanged, limitExceeded, totalDiscovered };
}
