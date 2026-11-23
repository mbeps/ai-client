"use client";

import { GitBranch, Globe, Play, Plus, Sparkles, Webhook } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkflowEditorStore } from "@/components/workflows/canvas/workflow-editor-store";
import type { WorkflowNodeType } from "@/types/workflows/workflow";

const PALETTE_ITEMS: Array<{
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: typeof Play;
}> = [
  {
    type: "manual_trigger",
    label: "Manual Trigger",
    description: "Run manually with optional input files",
    icon: Play,
  },
  {
    type: "webhook_trigger",
    label: "Webhook Trigger",
    description: "Start via authenticated HTTP POST",
    icon: Webhook,
  },
  {
    type: "ai_step",
    label: "AI Step",
    description: "Execute prompt with tools & canvas output",
    icon: Sparkles,
  },
  {
    type: "if_condition",
    label: "If Condition",
    description: "Branch True / False via rules or LLM",
    icon: GitBranch,
  },
  {
    type: "http_request",
    label: "HTTP Request",
    description: "Call an external REST API endpoint",
    icon: Globe,
  },
];

/**
 * Popover node palette converting viewport coordinates via `screenToFlowPosition` when adding nodes.
 */
export function WorkflowNodePalette({
  onAddNode,
}: {
  onAddNode: (
    type: WorkflowNodeType,
    position: { x: number; y: number },
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const editorInstance = useWorkflowEditorStore((s) => s.editorInstance);

  const handleSelect = (
    type: WorkflowNodeType,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const position = editorInstance
      ? editorInstance.screenToFlowPosition({
          x: e.clientX || 320,
          y: e.clientY || 220,
        })
      : { x: 240, y: 180 };
    onAddNode(type, position);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="default" className="shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Node
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="space-y-1">
          <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
            Workflow Nodes
          </p>
          {PALETTE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                onClick={(e) => handleSelect(item.type, e)}
                className="hover:bg-accent flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors"
              >
                <Icon className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
