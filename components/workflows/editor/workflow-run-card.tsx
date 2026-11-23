"use client";

import { formatDistanceToNow } from "date-fns";
import { Play } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import type { WorkflowRunItem } from "@/types/workflows/workflow";

/** Props for {@link WorkflowRunCard}. */
export interface WorkflowRunCardProps {
  run: WorkflowRunItem;
  workflowId: string;
}

/**
 * Clickable execution history card linking to the live workflow run workbench.
 */
export function WorkflowRunCard({ run, workflowId }: WorkflowRunCardProps) {
  const statusClass =
    run.status === "completed"
      ? "border-green-500 bg-green-50 text-green-600"
      : run.status === "failed"
        ? "border-red-500 bg-red-50 text-red-600"
        : "border-amber-500 bg-amber-50 text-amber-600";

  return (
    <Link
      href={ROUTES.WORKFLOWS.AUTOMATIONS.runs(workflowId, run.id)}
      className="group block"
    >
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="flex items-center justify-between px-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {new Date(run.createdAt).toLocaleString()}
              </span>
              <Badge variant="outline" className={statusClass}>
                {run.status.replaceAll("_", " ")}
              </Badge>
              <Badge variant="secondary">{run.triggerType}</Badge>
              {run.dryRun && <Badge variant="outline">Dry Run</Badge>}
            </div>
            <p className="text-muted-foreground text-xs">
              Started{" "}
              {formatDistanceToNow(new Date(run.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
          <Play className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-colors" />
        </CardContent>
      </Card>
    </Link>
  );
}
