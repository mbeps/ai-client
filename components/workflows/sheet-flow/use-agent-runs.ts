"use client";

import { useEffect, useState } from "react";
import { listTransformRuns } from "@/actions/transform-runs/list-transform-runs";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

/**
 * Loads and caches past transform runs for the specified agent.
 */
export function useAgentRuns(
  id: string,
  isNew: boolean,
  handleApiError: (err: unknown, fallbackMessage?: string) => boolean,
) {
  const [runs, setRuns] = useState<TransformRunRow[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    async function loadRuns() {
      setIsLoadingRuns(true);
      try {
        const result = await listTransformRuns(id);
        if (mounted) setRuns(result);
      } catch (err) {
        handleApiError(err, "Failed to load runs");
      } finally {
        if (mounted) setIsLoadingRuns(false);
      }
    }

    loadRuns();
    return () => {
      mounted = false;
    };
  }, [id, isNew, handleApiError]);

  return { runs, isLoadingRuns };
}
