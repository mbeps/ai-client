"use client";

import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Settings2, PlayCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TransformAgent } from "@/types/transform/transform-agent";
import { TransformAgentOptions } from "./transform-agent-options";
import { EntityCard } from "@/components/shared/entity-card";

/**
 * Props for TransformAgentCard component.
 *
 * @author Maruf Bepary
 */
interface TransformAgentCardProps {
  /** Transformation agent to display. */
  agent: TransformAgent;
}

/**
 * Displays a transformation agent in a horizontal card layout within a list.
 * Shows agent name, step count badge, description, and action buttons.
 * Features configure and run actions via tooltips, plus dropdown menu with rename/delete options.
 * Used in agent list views.
 *
 * @param agent - TransformAgent to render
 * @returns Horizontal card with agent details, actions, and menu options
 * @author Maruf Bepary
 */
export function TransformAgentCard({ agent }: TransformAgentCardProps) {
  return (
    <EntityCard
      horizontal
      icon={<Settings2 className="h-4 w-4 text-primary" />}
      title={
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold truncate">{agent.name}</h3>
          <Badge
            variant="secondary"
            className="h-5 px-1.5 text-[10px] font-medium"
          >
            {agent.steps.length} {agent.steps.length === 1 ? "step" : "steps"}
          </Badge>
        </div>
      }
      description={agent.description}
      rightActions={
        <div className="flex items-center gap-2">
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
        </div>
      }
      menu={<TransformAgentOptions agent={agent} />}
    />
  );
}
