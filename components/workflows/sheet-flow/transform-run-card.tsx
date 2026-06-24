"use client";

import { ROUTES } from "@/constants/routes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

interface TransformRunCardProps {
  run: TransformRunRow;
  agentId: string;
}

/**
 * A compact card component for displaying a transform run in a history list.
 */
export function TransformRunCard({ run, agentId }: TransformRunCardProps) {
  return (
    <Link
      href={ROUTES.WORKFLOWS.TRANSFORM.runs(agentId, run.id)}
      className="block group"
    >
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="px-4 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {run.createdAt.toLocaleString()}
              </span>
              <Badge
                variant="outline"
                className={
                  run.status === "completed"
                    ? "border-green-500 text-green-600 bg-green-50"
                    : run.status === "failed"
                      ? "border-red-500 text-red-600 bg-red-50"
                      : "border-amber-500 text-amber-600 bg-amber-50"
                }
              >
                {run.status.replace("_", " ")}
              </Badge>
              {run.dryRun && <Badge variant="outline">Dry Run</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Started{" "}
              {formatDistanceToNow(new Date(run.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
          <Play className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardContent>
      </Card>
    </Link>
  );
}
