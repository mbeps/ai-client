"use client";

import { useEffect, useState } from "react";
import { listTransformRuns } from "@/actions/transform-runs/list-transform-runs";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

/**
 * Loads and caches past transform runs for the specified agent.
 *
 * @param id - Target id
 * @param isNew - Target is new
 * @param handleApiError - Target handle api error
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
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
        if (!result.ok) {
          handleApiError(result.error, "Failed to load runs");
          return;
        }
        if (mounted) setRuns(result.value);
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
