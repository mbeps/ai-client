"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listModels } from "@/lib/actions/models/list-models";
import type { AiModelWithProvider } from "@/types/ai-model-row";
import type { ProviderModelType } from "@/schemas/provider-registry";
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
      .filter((model) => model.isEnabled)
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
