"use client";

import { useMemo } from "react";
import type { Assistant } from "@/types/assistant/assistant";
import type { Project } from "@/types/project/project";

export interface InitialToolsResult {
  /** Merged tool + resource identifiers from project and assistant. */
  initialToolsAndResources: string[];
  /** Server IDs extracted from the merged tool identifiers. */
  initialServerIds: string[];
  /** Tool identifiers (containing ":tool:") from the merged set. */
  initialSelectedTools: string[];
}

/**
 * Merges tool configurations from the associated project and assistant
 * into deduplicated sets for initializing the chat input.
 *
 * Tools are strings in the format `${serverId}:tool:${toolName}`.
 * Server IDs are extracted by taking the segment before the first colon.
 *
 * @param project - The associated project (may have `.tools` array).
 * @param assistant - The associated assistant (may have `.tools` array).
 * @returns Deduplicated sets of all tools, server IDs, and selected tools.
 */
export function useInitialTools(
  project: Project | null,
  assistant: Assistant | null,
): InitialToolsResult {
  const projectTools = project?.tools;
  const assistantTools = assistant?.tools;

  const initialToolsAndResources = useMemo(() => {
    const combined = new Set<string>();
    if (projectTools) {
      projectTools.forEach((t) => combined.add(t));
    }
    if (assistantTools) {
      assistantTools.forEach((t) => combined.add(t));
    }
    return Array.from(combined);
  }, [projectTools, assistantTools]);

  const initialServerIds = useMemo(() => {
    const serverIds = new Set<string>();
    initialToolsAndResources.forEach((t) => {
      const serverId = t.split(":")[0];
      if (serverId) serverIds.add(serverId);
    });
    return Array.from(serverIds);
  }, [initialToolsAndResources]);

  const initialSelectedTools = useMemo(() => {
    return initialToolsAndResources.filter((t) => t.includes(":tool:"));
  }, [initialToolsAndResources]);

  return { initialToolsAndResources, initialServerIds, initialSelectedTools };
}
