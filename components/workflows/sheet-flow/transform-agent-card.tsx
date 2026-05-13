"use client";

import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings2, PlayCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TransformAgent } from "@/types/transform-agent";
import { TransformAgentOptions } from "./transform-agent-options";

interface TransformAgentCardProps {
  agent: TransformAgent;
}

/**
 * A space-efficient card for displaying a transformation agent in a list.
 * Features a single-row layout with actions on the right.
 */
export function TransformAgentCard({ agent }: TransformAgentCardProps) {
  return (
    <Card className="flex flex-row items-center justify-between p-4 transition-colors hover:bg-muted/50">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold truncate">{agent.name}</h3>
          <Badge
            variant="secondary"
            className="h-5 px-1.5 text-[10px] font-medium"
          >
            {agent.steps.length} {agent.steps.length === 1 ? "step" : "steps"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {agent.description}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8" asChild>
              <Link href={ROUTES.WORKFLOWS.TRANSFORM.detail(agent.id)}>
                <Settings2 className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Configure Agent</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" className="h-8 w-8" asChild>
              <Link href={ROUTES.WORKFLOWS.TRANSFORM.detail(agent.id)}>
                <PlayCircle className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run Agent</TooltipContent>
        </Tooltip>

        <TransformAgentOptions agent={agent} />
      </div>
    </Card>
  );
}
