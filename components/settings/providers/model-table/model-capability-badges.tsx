"use client";

import { Badge } from "@/components/ui/badge";
import type { AiModelRow } from "@/types/provider/ai-model-row";

const CAPABILITY_CONFIGS = [
  { key: "capTools", label: "tools" },
  { key: "capVision", label: "vision" },
  { key: "capReasoning", label: "reasoning" },
  { key: "capStructuredOutput", label: "structured" },
] as const;

/**
 * Renders the model capability badges component.
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
      {activeCaps.map((c) => (
        <Badge key={c.key} variant="secondary">
          {c.label}
        </Badge>
      ))}
    </div>
  );
}
