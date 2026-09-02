"use client";

import { formatDistanceToNow } from "date-fns";
import { Play } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

/**
 * Props for TransformRunCard component.
 *
 * @author Maruf Bepary
 */
interface TransformRunCardProps {
  /** Transform run execution record to display. */
  run: TransformRunRow;
  /** ID of the parent transformation agent. */
  agentId: string;
}

/**
 * Displays a single transformation run execution record as a clickable card.
 * Shows execution timestamp, status badge (completed/failed/pending), dry-run indicator, and relative time.
 * Links to the run details page when clicked.
 * Used in agent run history lists.
 *
 * @param run - TransformRunRow with execution data and status
 * @param agentId - Parent agent ID for linking to run details
 * @returns Clickable card linking to run details with status and timing information
 * @author Maruf Bepary
 */
export function TransformRunCard({ run, agentId }: TransformRunCardProps) {
  return (
    <Link
      href={ROUTES.WORKFLOWS.TRANSFORM.runs(agentId, run.id)}
      className="group block"
    >
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="flex items-center justify-between px-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {run.createdAt.toLocaleString()}
              </span>
              <Badge
                variant="outline"
                className={
                  run.status === "completed"
                    ? "border-green-500 bg-green-50 text-green-600"
                    : run.status === "failed"
                      ? "border-red-500 bg-red-50 text-red-600"
                      : "border-amber-500 bg-amber-50 text-amber-600"
                }
              >
                {run.status.replace("_", " ")}
              </Badge>
              {run.dryRun && <Badge variant="outline">Dry Run</Badge>}
            </div>
            <p className="text-muted-foreground text-xs">
              Started{" "}
              {formatDistanceToNow(new Date(run.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
          <Play className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
        </CardContent>
      </Card>
    </Link>
  );
}
