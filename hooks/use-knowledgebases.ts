"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  listKnowledgebases,
  type KnowledgebaseWithCount,
} from "@/lib/actions/knowledgebases/list-knowledgebases";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";

/**
 * Fetches and manages knowledge base list with normalization and refresh control.
 * Replaces the removed knowledgebases store slice. Automatically loads on mount.
 * Provides both raw (with metadata counts) and normalized representations.
 *
 * Side effects: Fetches knowledge bases on mount, logs errors to console.
 * Use case: KnowledgeBase selection components, KB availability detection.
 * Constraint: Normalized form applies undefined to missing descriptions.
 *
 * @returns Object with knowledgebases (raw), normalizedKnowledgebases, isLoading state, refresh callback.
 * @throws No exceptions thrown; errors logged and swallowed.
 * @see listKnowledgebases server action for API contract.
 * @author Maruf Bepary
 */
export function useKnowledgebases() {
  const [knowledgebases, setKnowledgebases] = useState<
    KnowledgebaseWithCount[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const normalizedKnowledgebases = useMemo<Knowledgebase[]>(() => {
    return knowledgebases.map((kb) => ({
      ...kb,
      description: kb.description ?? undefined,
    }));
  }, [knowledgebases]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listKnowledgebases();
      setKnowledgebases(data);
    } catch (error) {
      console.error(
        "[useKnowledgebases] Failed to load knowledgebases:",
        error,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    knowledgebases,
    normalizedKnowledgebases,
    isLoading,
    refresh,
  };
}
