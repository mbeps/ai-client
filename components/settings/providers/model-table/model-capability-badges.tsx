"use client";

import { Braces, Brain, Eye, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AiModelRow } from "@/types/provider/ai-model-row";

const CAPABILITY_CONFIGS = [
  { key: "capTools", label: "Tools", icon: Wrench },
  { key: "capVision", label: "Vision", icon: Eye },
  { key: "capReasoning", label: "Reasoning", icon: Brain },
  { key: "capStructuredOutput", label: "Structured", icon: Braces },
] as const;

/**
 * Renders the model capability badges component with icons.
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
    <div className="flex flex-wrap gap-1">
      {activeCaps.map(({ key, label, icon: Icon }) => (
        <Badge
          key={key}
          variant="secondary"
          className="gap-1 px-1.5 py-0.5 text-xs font-normal"
        >
          <Icon className="size-3 shrink-0" />
          <span>{label}</span>
        </Badge>
      ))}
    </div>
  );
}
