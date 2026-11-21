"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getRagConfig,
  type RagConfig,
} from "@/actions/knowledgebases/get-rag-config";

const DEFAULT_RAG_CONFIG: RagConfig = {
  ragMode: "hybrid",
  requiresEmbedding: true,
};

/**
 * Return value of {@link useRagConfig}, extending {@link RagConfig} with loading,
 * error, and retry state so UI pages can recover from transient fetch failures.
 *
 * @author Maruf Bepary
 */
export type UseRagConfigResult = RagConfig & {
  isLoading: boolean;
  error: string | null;
  retry: () => void;
};

/**
 * Fetches the active server RAG configuration for Knowledge Base UI pages.
 * Defaults to `{ ragMode: "hybrid", requiresEmbedding: true }` until loaded
 * so embedding guards remain safe during initial render.
 *
 * @returns Current `{ ragMode, requiresEmbedding, isLoading, error, retry }` state.
 * @author Maruf Bepary
 */
export function useRagConfig(): UseRagConfigResult {
  const [config, setConfig] = useState<RagConfig>(DEFAULT_RAG_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setReloadTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void reloadTick;

    getRagConfig()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setConfig(res.value);
          setError(null);
        } else {
          setError(res.error.message || "Failed to load RAG configuration");
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load RAG configuration",
        );
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return {
    ...config,
    isLoading,
    error,
    retry,
  };
}
