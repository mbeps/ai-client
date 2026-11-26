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
      {headerSlot && <div className="border-b px-3 py-2">{headerSlot}</div>}
      <div className="min-h-0 flex-1">
        {selectedNode ? (
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
