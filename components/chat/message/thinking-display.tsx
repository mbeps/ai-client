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
        className="w-full overflow-hidden rounded-lg border border-muted bg-muted/20"
      >
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center gap-2 p-3 font-medium text-sm outline-none transition-colors hover:bg-muted/30",
            isOpen ? "border-muted border-b" : "",
          )}
        >
          <div className="flex flex-1 items-center gap-2 text-muted-foreground">
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <Brain className="size-4" />
            )}
            <span className="font-semibold text-xs uppercase tracking-wider">
              {stepNumber ? `Step ${stepNumber}: ` : ""}
              {isStreaming ? "Thinking..." : "Thought process"}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              isOpen ? "rotate-180" : "",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="custom-scrollbar max-h-[500px] overflow-y-auto bg-muted/10 p-4 text-muted-foreground/90 text-sm leading-relaxed">
            <MarkdownRenderer content={reasoning} />
            {isStreaming && (
              <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-primary/40 align-middle" />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
