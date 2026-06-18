"use client";

import { useState, useCallback } from "react";

interface UseMcpSelectionReturn {
  selectedServerIds: Set<string>;
  selectedTools: Set<string>;
  toggleServer: (id: string) => void;
  toggleTool: (serverId: string, toolName: string) => void;
  handleBulkSelect: (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => void;
  clearSelection: () => void;
}

/**
 * Manages MCP server and tool selection state for the chat input.
 * Provides toggles for individual servers, individual tools (auto-selects the parent server),
 * and bulk tool selection.
 *
 * @param initialServerIds - Pre-selected server IDs
 * @param initialTools - Pre-selected tool identifiers (format: "serverId:tool:toolName")
 * @returns Selection state and toggle helpers
 */
export function useMcpSelection(
  initialServerIds: string[] = [],
  initialTools: string[] = [],
): UseMcpSelectionReturn {
  const [selectedServerIds, setSelectedServerIds] = useState<Set<string>>(
    new Set(initialServerIds),
  );
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(initialTools),
  );

  const toggleServer = useCallback((id: string) => {
    setSelectedServerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSelectedTools((prevTools) => {
          const nextTools = new Set(prevTools);
          nextTools.forEach((tId) => {
            if (tId.startsWith(`${id}:`)) nextTools.delete(tId);
          });
          return nextTools;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleTool = useCallback((serverId: string, toolName: string) => {
    const toolId = `${serverId}:tool:${toolName}`;
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else {
        next.add(toolId);
        setSelectedServerIds((prevServers) =>
          new Set(prevServers).add(serverId),
        );
      }
      return next;
    });
  }, []);

  const handleBulkSelect = useCallback(
    (serverId: string, toolNames: string[], select: boolean) => {
      if (select) {
        setSelectedServerIds((prev) => new Set(prev).add(serverId));
        setSelectedTools((prev) => {
          const next = new Set(prev);
          toolNames.forEach((name) => next.add(`${serverId}:tool:${name}`));
          return next;
        });
      } else {
        setSelectedTools((prev) => {
          const next = new Set(prev);
          toolNames.forEach((name) => next.delete(`${serverId}:tool:${name}`));
          return next;
        });
      }
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedServerIds(new Set());
    setSelectedTools(new Set());
  }, []);

  return {
    selectedServerIds,
    selectedTools,
    toggleServer,
    toggleTool,
    handleBulkSelect,
    clearSelection,
  };
}
