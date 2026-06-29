"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listModels } from "@/lib/actions/models/list-models";
import type { AiModelWithProvider } from "@/types/provider/ai-model-row";
import type { ProviderModelType } from "@/schemas/providers/provider-registry";
import {
  fetchProviderRegistryWithCache,
  getProviderRegistryCachedData,
  isProviderRegistryCacheFresh,
  subscribeProviderRegistryCache,
} from "@/hooks/provider-registry-cache";

const RETRY_COUNT = 1;
const USER_MODEL_TYPES = ["chat", "embedding", "both"] as const;

function toUserModelType(value: string | null | undefined): ProviderModelType {
  return USER_MODEL_TYPES.find((type) => type === value) ?? "chat";
}

export type UserModelOption = {
  id: string;
  modelId: string;
  label: string;
  providerName: string;
  providerId: string;
  modelType: "chat" | "embedding" | "both";
  contextWindow: number;
  embeddingDimensions: number | null;
  capTools: boolean;
  capVision: boolean;
  capReasoning: boolean;
  capStructuredOutput: boolean;
  isEnabled: boolean;
  providerIsEnabled: boolean;
};

export type UseUserModelsResult = {
  models: UserModelOption[];
  rawModels: AiModelWithProvider[];
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  refresh: () => Promise<void>;
  invalidate: () => void;
};

/**
 * Fetches, filters, and normalises user-accessible AI models with type filtering.
 * Uses provider-registry-cache with 30-minute stale window.
 * Returns both raw (unfiltered with provider metadata) and processed models (filtered by type, sorted).
 * Filters by model type (chat, embedding, both) and enabled status (model + provider).
 * Automatically loads on mount if cache empty or stale; retries once on failure.
 *
 * Side effects: Fetches from cache or listModels() server action, subscribes to cache updates.
 * Use case: Model selector dropdowns, capability checking (tools, vision, reasoning), embedding model selection.
 * Constraint: Cache is global; invalidate() affects all component instances. Type filter only applies to returned models.
 *
 * @param type - Model type filter: 'chat' (default), 'embedding', or 'both'. Only affects models array, not rawModels.
 * @returns Object with models (filtered, sorted), rawModels (raw), loading/error states, staleness, refresh and invalidate methods.
 * @throws No exceptions thrown; errors returned in error field.
 * @see fetchProviderRegistryWithCache for cache implementation.
 * @see useProviders for provider list hook with same caching pattern.
 * @author Maruf Bepary
 */
export function useUserModels(
  type: ProviderModelType = "chat",
): UseUserModelsResult {
  const [rawModels, setRawModels] = useState<AiModelWithProvider[]>(
    () => getProviderRegistryCachedData<AiModelWithProvider[]>("models") ?? [],
  );
  const [isLoading, setIsLoading] = useState(rawModels.length === 0);
  const [error, setError] = useState<string | null>(null);

  const loadModels = useCallback(async (force?: boolean) => {
    setIsLoading(true);
    setError(null);

    let attempts = 0;

    while (true) {
      try {
        const models = await fetchProviderRegistryWithCache(
          "models",
          () => listModels({}),
          {
            force: force ?? false,
          },
        );

        setRawModels(models);
        setIsLoading(false);
        return;
      } catch (err) {
        if (attempts >= RETRY_COUNT) {
          setError(
            err instanceof Error ? err.message : "Failed to load models",
          );
          setIsLoading(false);
          return;
        }
        attempts += 1;
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribeModels = subscribeProviderRegistryCache("models", () => {
      const cached =
        getProviderRegistryCachedData<AiModelWithProvider[]>("models");
      setRawModels(cached ?? []);
    });

    return () => {
      unsubscribeModels();
    };
  }, []);

  useEffect(() => {
    const hasCached =
      (getProviderRegistryCachedData<AiModelWithProvider[]>("models")?.length ??
        0) > 0;

    if (!hasCached || !isProviderRegistryCacheFresh("models")) {
      void Promise.resolve().then(() => loadModels());
      return;
    }

    Promise.resolve().then(() => setIsLoading(false));
  }, [loadModels]);

  const models = useMemo(() => {
    const typeSet =
      type === "chat"
        ? new Set(["chat", "both"])
        : type === "embedding"
          ? new Set(["embedding", "both"])
          : new Set(["both"]);

    return rawModels
      .filter(
        (model) => model.isEnabled === true && model.providerIsEnabled === true,
      )
      .filter((model) => typeSet.has(model.modelType))
      .map((model) => ({
        id: model.id,
        modelId: model.modelId,
        label: model.label,
        providerId: model.providerId,
        providerName: model.providerName,
        modelType: toUserModelType(model.modelType),
        contextWindow: model.contextWindow,
        embeddingDimensions: model.embeddingDimensions,
        capTools: model.capTools,
        capVision: model.capVision,
        capReasoning: model.capReasoning,
        capStructuredOutput: model.capStructuredOutput,
        isEnabled: model.isEnabled,
        providerIsEnabled: model.providerIsEnabled,
      }))
      .sort((a, b) => {
        if (a.providerName !== b.providerName) {
          return a.providerName.localeCompare(b.providerName);
        }

        return a.label.localeCompare(b.label);
      });
  }, [rawModels, type]);

  return {
    models,
    rawModels,
    isLoading,
    error,
    isStale: !isProviderRegistryCacheFresh("models"),
    refresh: () => loadModels(true),
    invalidate: () => {}, // Cache is invalidated via registry events
  };
}
