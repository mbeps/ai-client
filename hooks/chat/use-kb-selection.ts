"use client";

import { useState, useCallback } from "react";

interface UseKbSelectionReturn {
  selectedKbs: Set<string>;
  handleToggleKb: (id: string) => void;
  handleRemoveKb: (id: string) => void;
  clearKbs: () => void;
}

/**
 * Manages knowledge base selection state for the chat input.
 * Provides toggle and remove handlers, with an optional callback
 * to notify the parent of changes.
 *
 * @param initialKbs - Pre-selected knowledge base IDs
 * @param onKnowledgebaseChange - Optional callback invoked when selection changes
 * @returns Selection state and toggle/remove helpers
 */
export function useKbSelection(
  initialKbs: string[] = [],
  onKnowledgebaseChange?: (ids: string[]) => void,
): UseKbSelectionReturn {
  const [selectedKbs, setSelectedKbs] = useState<Set<string>>(
    new Set(initialKbs),
  );

  const handleToggleKb = useCallback(
    (id: string) => {
      setSelectedKbs((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        onKnowledgebaseChange?.(Array.from(next));
        return next;
      });
    },
    [onKnowledgebaseChange],
  );

  const handleRemoveKb = useCallback(
    (id: string) => {
      setSelectedKbs((prev) => {
        const next = new Set(prev);
        next.delete(id);
        onKnowledgebaseChange?.(Array.from(next));
        return next;
      });
    },
    [onKnowledgebaseChange],
  );

  const clearKbs = useCallback(() => {
    setSelectedKbs(new Set());
    onKnowledgebaseChange?.([]);
  }, [onKnowledgebaseChange]);

  return {
    selectedKbs,
    handleToggleKb,
    handleRemoveKb,
    clearKbs,
  };
}
