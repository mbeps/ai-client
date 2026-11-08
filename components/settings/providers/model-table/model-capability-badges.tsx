"use client";

import { Braces, Brain, Eye, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AiModelRow } from "@/types/provider/ai-model-row";

const CAPABILITY_CONFIGS = [
  { key: "capTools", label: "Tool Calling", icon: Wrench },
  { key: "capVision", label: "Vision", icon: Eye },
  { key: "capReasoning", label: "Reasoning", icon: Brain },
  { key: "capStructuredOutput", label: "Structured Output", icon: Braces },
] as const;

/**
 * Renders the model capability icon-only badges with tooltips showing capability names.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function ModelCapabilityBadges({ model }: { model: AiModelRow }) {
  const activeCaps = CAPABILITY_CONFIGS.filter((c) => Boolean(model[c.key]));

  if (activeCaps.length === 0) {
    return <span className="text-muted-foreground text-xs">none</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {activeCaps.map(({ key, label, icon: Icon }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              aria-label={label}
              tabIndex={0}
              className="size-6 cursor-default p-0"
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="sr-only">{label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
