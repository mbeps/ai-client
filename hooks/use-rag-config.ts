"use client";

import { useEffect, useState } from "react";
import {
  getRagConfig,
  type RagConfig,
} from "@/actions/knowledgebases/get-rag-config";

const DEFAULT_RAG_CONFIG: RagConfig = {
  ragMode: "hybrid",
  requiresEmbedding: true,
};

/**
 * Fetches the active server RAG configuration for Knowledge Base UI pages.
 * Defaults to `{ ragMode: "hybrid", requiresEmbedding: true }` until loaded
 * so embedding guards remain safe during initial render.
 *
 * @returns Current `{ ragMode, requiresEmbedding }` configuration.
 * @author Maruf Bepary
 */
export function useRagConfig(): RagConfig {
  const [config, setConfig] = useState<RagConfig>(DEFAULT_RAG_CONFIG);

  useEffect(() => {
    let cancelled = false;

    getRagConfig()
      .then((res) => {
        if (!cancelled && res.ok) {
          setConfig(res.value);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
