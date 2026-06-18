"use client";

import { useState, useCallback } from "react";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Manages the list of active tool invocations during a streaming response.
 * Provides helpers to add new calls and update existing ones by ID.
 */
export function useToolCalls() {
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallState[]>([]);

  const addToolCall = useCallback(
    (toolCallId: string, toolName: string, args?: unknown) => {
      setActiveToolCalls((prev) => [
        ...prev,
        { toolCallId, toolName, args, status: "calling" },
      ]);
    },
    [],
  );

  const updateToolCall = useCallback(
    (
      toolCallId: string,
      updates: Partial<Pick<ToolCallState, "status" | "result">>,
    ) => {
      setActiveToolCalls((prev) =>
        prev.map((tc) =>
          tc.toolCallId === toolCallId ? { ...tc, ...updates } : tc,
        ),
      );
    },
    [],
  );

  const clearToolCalls = useCallback(() => {
    setActiveToolCalls([]);
  }, []);

  return {
    activeToolCalls,
    setActiveToolCalls,
    addToolCall,
    updateToolCall,
    clearToolCalls,
  };
}
