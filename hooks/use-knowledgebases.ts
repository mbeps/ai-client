"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  listKnowledgebases,
  type KnowledgebaseWithCount,
} from "@/lib/actions/knowledgebases/list-knowledgebases";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";

/**
 * Hook for managing knowledge base list fetching and state.
 * Replaces the removed knowledgebases store property.
 *
 * @returns { knowledgebases: KnowledgebaseWithCount[], normalizedKnowledgebases: Knowledgebase[], isLoading: boolean, refresh: () => Promise<void> }
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
