"use client";

import { BrainCircuit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { UserModelOption } from "@/hooks/use-user-models";
import { formatTokens } from "@/lib/chat/calculate-context-tokens";

/**
 * Props for the ModelDetailsHoverCard component.
 */
interface ModelDetailsHoverCardProps {
  /** The model to describe. */
  model: UserModelOption;
  /** Content that opens the hover card. Must be a single focusable-free element. */
  children: React.ReactNode;
  /** Popup placement relative to the trigger. */
  side?: React.ComponentProps<typeof HoverCardContent>["side"];
}

/**
 * Wraps model list content with a hover card describing context window,
 * capabilities, and reasoning support.
 *
 * @param props - The model, its trigger content, and popup placement.
 * @returns A hover card that reveals model metadata on hover.
 */
export function ModelDetailsHoverCard({
  model,
  children,
  side = "right",
}: ModelDetailsHoverCardProps) {
  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side={side} align="start" className="w-64 p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-xs">{model.label}</span>
            <span className="text-[10px] text-muted-foreground">
              {model.providerName}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
              Context Window
            </span>
            <span className="text-xs">
              {model.contextWindow.toLocaleString() ?? "Unknown"} tokens (
              {model.contextWindow ? formatTokens(model.contextWindow) : "?"})
            </span>
          </div>

          {(model.capTools ||
            model.capVision ||
            model.capReasoning ||
            model.capStructuredOutput) && (
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                Capabilities
              </span>
              <div className="flex flex-wrap gap-1">
                {model.capTools ? <ModelBadge>tools</ModelBadge> : null}
                {model.capVision ? <ModelBadge>vision</ModelBadge> : null}
                {model.capReasoning ? <ModelBadge>reasoning</ModelBadge> : null}
                {model.capStructuredOutput ? (
                  <ModelBadge>structured output</ModelBadge>
                ) : null}
              </div>
            </div>
          )}

          {model.capReasoning && (
            <div className="mt-0.5 flex flex-col gap-1.5 border-border/50 border-t pt-2.5">
              <div className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                <BrainCircuit className="h-3 w-3 text-amber-500" />
                Reasoning
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="h-4 border-amber-500/20 bg-amber-500/5 px-1.5 py-0 font-medium text-[10px] text-amber-600"
                >
                  Enabled
                </Badge>
              </div>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ModelBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="secondary" className="h-4 px-1 py-0 text-[10px] capitalize">
      {children}
    </Badge>
  );
}
