"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WorkflowNodeInspectorView } from "@/components/workflows/canvas/workflow-node-inspector-view";
import { WorkflowPaletteView } from "@/components/workflows/canvas/workflow-palette-view";
import type { Agent } from "@/types/agent/agent";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { Skill } from "@/types/skill/skill";
import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
} from "@/types/workflows/workflow";

/** Props for {@link WorkflowRightPanel}. */
export interface WorkflowRightPanelProps {
  workflowId: string;
  selectedNode: WorkflowNode | null;
  allNodes: WorkflowNode[];
  edges: WorkflowEdge[];
  webhookSecret?: string | null;
  mcpServers: McpServer[];
  knowledgebases?: Knowledgebase[];
  skills?: Skill[];
  agents?: Agent[];
  panelMode?: "build" | "chat";
  onPanelModeChange?: (mode: "build" | "chat") => void;
  chatSlot?: ReactNode;
  headerSlot?: ReactNode;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  onAddNode: (type: WorkflowNodeType) => void;
  onAddAgentNode: (agent: Agent) => void;
  onDeselectNode: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onRegenerateWebhookSecret?: () => Promise<void> | void;
}

/**
 * Docked right panel for the Workflow Studio, switching between the node
 * palette and the selected node inspector.
 */
export function WorkflowRightPanel({
  workflowId,
  selectedNode,
  allNodes,
  edges,
  webhookSecret,
  mcpServers,
  knowledgebases = [],
  skills = [],
  agents = [],
  panelMode = "build",
  onPanelModeChange,
  chatSlot,
  headerSlot,
  mobileOpen = false,
  onMobileOpenChange,
  onAddNode,
  onAddAgentNode,
  onDeselectNode,
  onUpdateNode,
  onDeleteNode,
  onRegenerateWebhookSecret,
}: WorkflowRightPanelProps) {
  const content = (
    <div className="flex h-full min-h-0 flex-col">
      {(headerSlot || onPanelModeChange) && (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          {onPanelModeChange && (
            <div
              role="tablist"
              aria-label="Studio panel mode"
              className="bg-muted grid w-full grid-cols-2 rounded-md p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={panelMode === "build"}
                onClick={() => onPanelModeChange("build")}
                className={`rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
                  panelMode === "build"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Build
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panelMode === "chat"}
                onClick={() => onPanelModeChange("chat")}
                className={`rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
                  panelMode === "chat"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                AI Chat
              </button>
            </div>
          )}
          {headerSlot}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {panelMode === "chat" && chatSlot ? (
          chatSlot
        ) : selectedNode ? (
          <WorkflowNodeInspectorView
            node={selectedNode}
            allNodes={allNodes}
            edges={edges}
            workflowId={workflowId}
            webhookSecret={webhookSecret}
            mcpServers={mcpServers}
            knowledgebases={knowledgebases}
            skills={skills}
            agents={agents}
            onBack={onDeselectNode}
            onUpdateNode={onUpdateNode}
            onDeleteNode={onDeleteNode}
            onRegenerateWebhookSecret={onRegenerateWebhookSecret}
          />
        ) : (
          <WorkflowPaletteView
            agents={agents}
            onAddNode={onAddNode}
            onAddAgentNode={onAddAgentNode}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-label="Workflow studio panel"
        className="bg-background hidden h-full w-[360px] shrink-0 flex-col border-l lg:flex xl:w-[400px]"
      >
        {content}
      </aside>

      {onMobileOpenChange && (
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md lg:hidden">
            <SheetHeader className="sr-only">
              <SheetTitle>Workflow Studio Panel</SheetTitle>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
