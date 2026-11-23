"use client";

import type { ReactFlowInstance } from "@xyflow/react";
import { create } from "zustand";

interface WorkflowEditorStoreState {
  editorInstance: ReactFlowInstance | null;
  selectedNodeId: string | null;
  setEditorInstance: (instance: ReactFlowInstance | null) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
}

/**
 * Minimal Zustand bridge exposing the active `ReactFlowInstance` and selected node ID
 * to header Save actions and external inspector panels outside `<ReactFlow>`.
 */
export const useWorkflowEditorStore = create<WorkflowEditorStoreState>(
  (set) => ({
    editorInstance: null,
    selectedNodeId: null,
    setEditorInstance: (editorInstance) => set({ editorInstance }),
    setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  }),
);
