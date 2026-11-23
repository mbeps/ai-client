"use client";

import { PlayCircle, Settings2, Workflow } from "lucide-react";
import Link from "next/link";
import { EntityCard } from "@/components/shared/entity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WorkflowOptions } from "@/components/workflows/editor/workflow-options";
import { ROUTES } from "@/config/routes";
import type { WorkflowItem } from "@/types/workflows/workflow";

/** Props for {@link WorkflowCard}. */
export interface WorkflowCardProps {
  workflow: WorkflowItem;
}

/**
 * Displays a visual DAG workflow item in the workflows list page.
 */
export function WorkflowCard({ workflow }: WorkflowCardProps) {
  const count = workflow.nodeCount ?? 0;

  return (
    <EntityCard
      horizontal
      icon={<Workflow className="text-primary h-4 w-4" />}
      title={
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold">{workflow.name}</h3>
          <Badge
            variant="secondary"
            className="h-5 px-1.5 text-[10px] font-medium"
          >
            {count} {count === 1 ? "node" : "nodes"}
          </Badge>
        </div>
      }
      description={workflow.description}
      rightActions={
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                <Link href={ROUTES.WORKFLOWS.AUTOMATIONS.detail(workflow.id)}>
                  <Settings2 className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit Workflow</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" className="h-8 w-8" asChild>
                <Link
                  href={`${ROUTES.WORKFLOWS.AUTOMATIONS.detail(workflow.id)}?tab=runs`}
                >
                  <PlayCircle className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>View Runs</TooltipContent>
          </Tooltip>
        </div>
      }
      menu={<WorkflowOptions workflow={workflow} />}
    />
  );
}
