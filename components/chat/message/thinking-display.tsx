"use client";

import { Brain, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "../markdown-renderer";

interface ThinkingDisplayProps {
  reasoning: string;
  isStreaming?: boolean;
  initialOpen?: boolean;
  stepNumber?: number;
}

/**
 * Displays extended reasoning or "thinking" output from models with chain-of-thought capabilities.
 * Shows in a collapsible container with an animated loading state while streaming.
 * Used in ResponseTimeline to show model reasoning steps before tool calls or responses.
 *
 * @param props.reasoning - The reasoning text or markdown content to display.
 * @param props.isStreaming - Whether the reasoning is actively streaming.
 * @param props.initialOpen - Whether to show the content expanded on first render.
 * @param props.stepNumber - Optional step number for display (e.g. "Step 1").
 * @author Maruf Bepary
 */
export function ThinkingDisplay({
  reasoning,
  isStreaming,
  initialOpen = false,
  stepNumber,
}: ThinkingDisplayProps) {
  const [isOpen, setIsOpen] = useState(initialOpen || !!isStreaming);
  const [hasOpenedFromStreaming, setHasOpenedFromStreaming] = useState(false);

  // Auto-open once when streaming starts
  if (isStreaming && !isOpen && !hasOpenedFromStreaming) {
    setIsOpen(true);
    setHasOpenedFromStreaming(true);
  }

  if (!reasoning && !isStreaming) return null;

  return (
    <div className="mb-3">
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="border-muted bg-muted/20 w-full overflow-hidden rounded-lg border"
      >
        <CollapsibleTrigger
          className={cn(
            "hover:bg-muted/30 flex w-full items-center gap-2 p-3 text-sm font-medium transition-colors outline-none",
            isOpen ? "border-muted border-b" : "",
          )}
        >
          <div className="text-muted-foreground flex flex-1 items-center gap-2">
            {isStreaming ? (
              <Loader2 className="text-primary size-4 animate-spin" />
            ) : (
              <Brain className="size-4" />
            )}
            <span className="text-xs font-semibold tracking-wider uppercase">
              {stepNumber ? `Step ${stepNumber}: ` : ""}
              {isStreaming ? "Thinking..." : "Thought process"}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4 transition-transform duration-200",
              isOpen ? "rotate-180" : "",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="custom-scrollbar bg-muted/10 text-muted-foreground/90 max-h-[500px] overflow-y-auto p-4 text-sm leading-relaxed">
            <MarkdownRenderer content={reasoning} />
            {isStreaming && (
              <span className="bg-primary/40 ml-1 inline-block h-4 w-1.5 animate-pulse align-middle" />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
